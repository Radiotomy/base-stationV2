import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { sonicPost, resolveClipId, webhookConfig } from '../../shared/sonicClient.ts';
import { SONIC_COSTS } from '../../shared/sonicPricing.ts';
import { resolveSonicModel, sonicRenderedBy } from '../../shared/sonicModels.ts';

/**
 * Sonic edit tools on an existing library track (audit 2026-09-03, docs.aimusicapi.ai):
 *
 *   remaster         POST /sonic/create  task_type=remaster, variation_category subtle|normal|high  (10)
 *   replace_section  POST /sonic/replace-section  infill_lyrics + infill_start_s/end_s, auto_concat  (10)
 *   add_vocals       POST /sonic/create  task_type=add_vocals, overpainting_start_s/end_s            (10)
 *   add_instrumental POST /sonic/create  task_type=add_instrumental                                   (10)
 *   concat           POST /sonic/create  task_type=concat_music — stitch an extension into one file  (2)
 *
 * add_vocals / add_instrumental only accept clips that came through /sonic/upload,
 * so those always upload the source (+2). Everything else reuses the track's own
 * Sonic clip_id when it has one. Results are ordinary Sonic music jobs, finalized
 * by pollGenerationJob (persist, auto-save to library, deduct on completion).
 *
 * Payload: { assetId, action, mv?, title?, tags?, ...action params }
 */
const clamp01 = (v) => Math.max(0, Math.min(1, Number(v)));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const p = await req.json();
    const { assetId, action, title, tags } = p;
    const mv = resolveSonicModel(p.mv);
    if (!assetId || !action) return Response.json({ error: 'assetId and action required' }, { status: 400 });
    if (!(action in SONIC_COSTS) || action === 'upload' || action.startsWith('stems')) {
      return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    const source = (await base44.entities.UserAsset.filter({ id: assetId }))[0];
    if (!source) return Response.json({ error: 'Source asset not found' }, { status: 404 });

    const requireUploaded = action === 'add_vocals' || action === 'add_instrumental';
    const hasClip = requireUploaded ? !!source.metadata?.sonic_upload_clip_id
      : !!(source.metadata?.clip_id || source.metadata?.sonic_upload_clip_id);
    const cost = SONIC_COSTS[action] + (hasClip ? 0 : SONIC_COSTS.upload);

    const recs = await base44.asServiceRole.entities.UserCredit.filter({ user_id: user.id });
    const balance = recs[0]?.balance ?? 0;
    if (balance < cost) {
      return Response.json({
        error: 'Insufficient credits', required: cost, balance,
        message: `This edit costs ${cost} credits. You have ${balance}.`,
      }, { status: 402 });
    }

    // Validation per action
    if (action === 'replace_section') {
      const s = Number(p.infill_start_s), e = Number(p.infill_end_s);
      if (!(s >= 0) || !(e > s)) return Response.json({ error: 'Section start must be ≥ 0 and end must be after start' }, { status: 400 });
      if (!p.infill_lyrics?.trim()) return Response.json({ error: 'New lyrics for the section are required' }, { status: 400 });
    }
    if (action === 'add_vocals' && !p.lyrics?.trim()) {
      return Response.json({ error: 'Lyrics are required to add vocals' }, { status: 400 });
    }

    let taskId, clipId, body;
    try {
      ({ clipId } = await resolveClipId(base44, source, { requireUploaded }));
      const wh = webhookConfig() || {};

      if (action === 'replace_section') {
        body = {
          clip_id: clipId, mv,
          infill_start_s: Number(p.infill_start_s), infill_end_s: Number(p.infill_end_s),
          infill_lyrics: String(p.infill_lyrics).slice(0, 3000),
          prompt: String(p.context_lyrics || source.metadata?.lyrics || p.infill_lyrics).slice(0, 5000),
          title: String(title || source.title || 'Track').slice(0, 200),
          auto_concat: true,
          ...(tags && { tags: String(tags).slice(0, 120) }),
          ...(p.negative_tags && { negative_tags: String(p.negative_tags) }),
          ...(p.style_weight != null && { style_weight: clamp01(p.style_weight) }),
          ...(p.weirdness_constraint != null && { weirdness_constraint: clamp01(p.weirdness_constraint) }),
          ...((p.vocal_gender === 'f' || p.vocal_gender === 'm') && { vocal_gender: p.vocal_gender }),
          ...wh,
        };
        ({ task_id: taskId } = await sonicPost('/sonic/replace-section', body));
      } else {
        body = { continue_clip_id: clipId, mv, use_suno_cdn: false, ...wh };
        if (action === 'remaster') {
          body.task_type = 'remaster';
          body.variation_category = ['subtle', 'normal', 'high'].includes(p.variation_category) ? p.variation_category : 'subtle';
        } else if (action === 'concat') {
          body.task_type = 'concat_music';
        } else {
          body.task_type = action; // add_vocals | add_instrumental
          body.custom_mode = true;
          body.prompt = String(p.lyrics || '').slice(0, 5000);
          body.tags = String(tags || source.metadata?.genre || 'pop').slice(0, 1000);
          body.style_weight = clamp01(p.style_weight ?? 0.5);
          body.weirdness_constraint = clamp01(p.weirdness_constraint ?? 0.3);
          body.audio_weight = clamp01(p.audio_weight ?? 0.7);
          body.overpainting_start_s = Math.max(0, Math.round(Number(p.start_s) || 0));
          body.overpainting_end_s = Math.max(body.overpainting_start_s + 1, Math.round(Number(p.end_s) || (source.metadata?.duration || 30)));
          body.vocal_gender = p.vocal_gender === 'm' ? 'm' : 'f';
        }
        ({ task_id: taskId } = await sonicPost('/sonic/create', body));
      }
      if (!taskId) throw new Error('Sonic returned no task_id');
    } catch (e) {
      const s = e.providerStatus;
      return Response.json({ error: e.message, provider_status: s || null }, { status: s === 400 ? 400 : s === 402 ? 402 : s === 429 ? 429 : 502 });
    }

    const startedAt = new Date().toISOString();
    const labels = { remaster: 'Remaster', replace_section: 'Section replaced', add_vocals: 'Vocals added', add_instrumental: 'Instrumental added', concat: 'Full song' };
    const job = await base44.entities.GenerationJob.create({
      user_id: user.id, user_email: user.email,
      job_type: 'music', provider: 'sonic', status: 'processing',
      ai_label: 'ai_generated',
      input_data: {
        task_kind: `sonic_${action}`, action, assetId, source_title: source.title, clip_id: clipId,
        model: mv, credit_cost: cost,
        title: title || `${source.title} — ${labels[action]}`,
        lyrics: p.lyrics || p.infill_lyrics || source.metadata?.lyrics || '',
        genre: source.metadata?.genre || null, mood: source.metadata?.mood || null,
        params: { ...p, assetId: undefined },
      },
      provider_job_id: taskId, started_at: startedAt,
    });

    base44.asServiceRole.entities.APIUsageLog.create({
      user_id: user.id, user_email: user.email, user_name: user.full_name,
      provider: 'sonic', task: `sonic_${action}`, credits_used: 0, status: 'pending',
      timestamp: startedAt, job_id: job.id,
      metadata: { action, source_asset_id: assetId, clip_id: clipId, provider_job_id: taskId, model_version: mv, rendered_by: sonicRenderedBy(mv) },
    }).catch(() => {});

    return Response.json({ job_id: job.id, status: 'processing', cost });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});