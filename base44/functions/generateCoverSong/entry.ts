// Sonic "Upload and Cover Music" — single combined endpoint.
//
// Docs: https://docs.aimusicapi.ai/api-32136901 (upload-cover, combined)
//       https://docs.aimusicapi.ai/api-32136899 (create reference)
//
// Workflow:
//   1) POST /api/v1/sonic/upload-cover  { url, custom_mode, mv, prompt|gpt_..., ... }
//      → { task_id, steps: { upload, cover } }
//   2) Poll get-music with task_id (handled by pollGenerationJob)
//
// Credits: 10 (Sonic generation)
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SONIC_API_KEY = Deno.env.get('SONIC_API_KEY');
const WEBHOOK_SECRET = Deno.env.get('AIMUSICAPI_WEBHOOK_SECRET') || '';
const AI_BASE = 'https://api.aimusicapi.ai/api/v1';
const COVER_COST = 10;

const SONIC_LIMITS = {
  'sonic-v3-5':      { prompt: 3000, tags: 200 },
  'sonic-v4':        { prompt: 3000, tags: 200 },
  'sonic-v4-5':      { prompt: 5000, tags: 1000 },
  'sonic-v4-5-plus': { prompt: 5000, tags: 1000 },
  'sonic-v5':        { prompt: 5000, tags: 1000 },
  'sonic-v5-5':      { prompt: 5000, tags: 1000 },
};
const VOCAL_GENDER_MODELS = new Set(['sonic-v4-5', 'sonic-v4-5-plus', 'sonic-v5', 'sonic-v5-5']);

function getWebhookConfig() {
  const url = Deno.env.get('AIMUSICAPI_WEBHOOK_URL');
  if (!url || !WEBHOOK_SECRET) return null;
  if (!url.startsWith('https://') || url.length > 1024) return null;
  return { webhook_url: url, webhook_secret: WEBHOOK_SECRET };
}

// Make the source URL publicly fetchable by Sonic's servers.
// Private Base44 file URLs return 400/404 to unauthenticated requests, so we
// re-host them via UploadFile (public CDN URL).
async function ensurePublicUrl(base44, sourceUrl) {
  try {
    const probe = await fetch(sourceUrl, { method: 'GET', headers: { Range: 'bytes=0-1' } });
    if (probe.ok || probe.status === 206) return sourceUrl;
  } catch { /* fall through */ }

  console.log('Source not publicly reachable, re-hosting via UploadFile:', sourceUrl);
  const r = await fetch(sourceUrl);
  if (!r.ok) throw new Error(`Could not read source audio (HTTP ${r.status}). Re-upload the file and try again.`);
  const blob = await r.blob();
  const name = (sourceUrl.split('/').pop() || 'source.mp3').split('?')[0].replace(/[^\w.\-]/g, '_');
  const file = new File([blob], name, { type: blob.type || 'audio/mpeg' });
  const uploaded = await base44.integrations.Core.UploadFile({ file });
  console.log('Re-hosted to:', uploaded.file_url);
  return uploaded.file_url;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
      url,                       // required — source audio URL (≤ 8 min)
      mv = 'sonic-v4-5',
      custom_mode = true,
      prompt,
      gpt_description_prompt,
      title,
      tags,
      negative_tags,
      make_instrumental = false,
      style_weight,
      weirdness_constraint,
      audio_weight,
      vocal_gender,
      genre,
      mood,
    } = body;

    // ── Validation ───────────────────────────────────────────────────────────
    if (!url) return Response.json({ error: 'Provide source audio `url`' }, { status: 400 });
    if (!SONIC_LIMITS[mv]) return Response.json({ error: `Invalid model: ${mv}` }, { status: 400 });
    if (custom_mode && (!prompt || !prompt.trim()) && !make_instrumental) {
      return Response.json({ error: 'Custom mode requires lyrics in `prompt` (or enable instrumental)' }, { status: 400 });
    }
    if (!custom_mode && (!gpt_description_prompt || !gpt_description_prompt.trim())) {
      return Response.json({ error: 'AI mode requires `gpt_description_prompt`' }, { status: 400 });
    }

    // ── Credit gate ──────────────────────────────────────────────────────────
    const credits = await base44.asServiceRole.entities.UserCredit.filter({ user_id: user.id });
    const balance = credits[0]?.balance ?? 0;
    if (balance < COVER_COST) {
      return Response.json({
        error: 'Insufficient credits',
        required: COVER_COST, balance,
        message: `Cover generation costs ${COVER_COST} credits. You have ${balance}.`,
      }, { status: 402 });
    }

    // ── Build Sonic upload-cover body ────────────────────────────────────────
    const limits = SONIC_LIMITS[mv];
    const tagParts = [tags, genre, mood].filter(Boolean).map(s => String(s).trim()).filter(Boolean);
    const mergedTags = tagParts.join(', ').slice(0, limits.tags);

    const apiBody = {
      custom_mode: !!custom_mode,
      mv,
    };
    if (custom_mode) apiBody.prompt = String(prompt || '').slice(0, limits.prompt);
    else             apiBody.gpt_description_prompt = String(gpt_description_prompt).slice(0, 400);
    if (title)        apiBody.title = String(title).slice(0, 80);
    if (mergedTags)   apiBody.tags = mergedTags;
    if (negative_tags) apiBody.negative_tags = String(negative_tags).slice(0, limits.tags);
    if (make_instrumental) apiBody.make_instrumental = true;
    if (typeof style_weight === 'number')         apiBody.style_weight = Math.max(0, Math.min(1, style_weight));
    if (typeof weirdness_constraint === 'number') apiBody.weirdness_constraint = Math.max(0, Math.min(1, weirdness_constraint));
    if (typeof audio_weight === 'number')         apiBody.audio_weight = Math.max(0, Math.min(1, audio_weight));
    if (vocal_gender && VOCAL_GENDER_MODELS.has(mv) && (vocal_gender === 'f' || vocal_gender === 'm')) {
      apiBody.vocal_gender = vocal_gender;
    }
    const wh = getWebhookConfig();
    if (wh) Object.assign(apiBody, wh);

    // ── Create the GenerationJob so the client can poll immediately ─────────
    const generatedAt = new Date().toISOString();
    const job = await base44.entities.GenerationJob.create({
      user_id: user.id, user_email: user.email,
      job_type: 'music', provider: 'sonic',
      status: 'processing',
      input_data: {
        cover_of: url,
        mv,
        custom_mode: !!custom_mode,
        prompt: custom_mode ? String(prompt || '').slice(0, 500) : undefined,
        gpt_description_prompt: !custom_mode ? gpt_description_prompt : undefined,
        title,
        tags: mergedTags,
        negative_tags,
        make_instrumental: !!make_instrumental,
        style_weight, weirdness_constraint, audio_weight,
        vocal_gender: apiBody.vocal_gender || null,
        genre, mood,
        lyrics: custom_mode ? prompt : '',
        model: mv,
        credit_cost: COVER_COST,
        task_kind: 'cover_upload_music',
        stage: 'submitting',
      },
      started_at: generatedAt,
    });

    base44.asServiceRole.entities.APIUsageLog.create({
      user_id: user.id, user_email: user.email, user_name: user.full_name,
      provider: 'sonic', task: 'generate_cover_song',
      credits_used: 0, status: 'pending',
      timestamp: generatedAt, job_id: job.id,
      metadata: { model_version: mv, base44_job_id: job.id, task_kind: 'cover_upload_music' },
    }).catch(() => {});

    // ── Background: ensure public URL + call combined upload-cover ──────────
    // Fire-and-forget so we return under the gateway timeout. Sonic's
    // combined endpoint can take 30-60s for the upload phase alone.
    (async () => {
      try {
        const publicUrl = await ensurePublicUrl(base44, url);
        apiBody.url = publicUrl;

        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 90000);
        let res, data;
        try {
          res = await fetch(`${AI_BASE}/sonic/upload-cover`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${SONIC_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(apiBody),
            signal: controller.signal,
          });
          data = await res.json();
        } finally { clearTimeout(t); }

        console.log('Sonic upload-cover response:', JSON.stringify(data));
        const taskId = data?.task_id || data?.data?.task_id;
        if (!res.ok || !taskId) {
          const msg = data?.error || data?.message || `Sonic HTTP ${res.status}`;
          await base44.asServiceRole.entities.GenerationJob.update(job.id, {
            status: 'failed',
            error_message: msg,
            completed_at: new Date().toISOString(),
          });
          return;
        }

        const uploadClipId = data?.steps?.upload?.clip_id || null;
        await base44.asServiceRole.entities.GenerationJob.update(job.id, {
          provider_job_id: taskId,
          input_data: {
            ...job.input_data,
            upload_clip_id: uploadClipId,
            public_source_url: publicUrl,
            stage: 'processing',
          },
        });
      } catch (e) {
        await base44.asServiceRole.entities.GenerationJob.update(job.id, {
          status: 'failed',
          error_message: e.message || 'Background submission failed',
          completed_at: new Date().toISOString(),
        }).catch(() => {});
      }
    })();

    return Response.json({
      job_id: job.id,
      status: 'processing',
      stage: 'submitting',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});