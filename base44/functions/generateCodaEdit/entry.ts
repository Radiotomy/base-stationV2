// Submit an ACE-Step edit task (cover / repaint / extract) to the Coda engine.
// Same submit-and-poll lifecycle as Coda text2music: the job row is created
// 'processing' here and finalized (persist + asset + credit deduction) by
// pollCodaEditJob. Credits are only deducted on completion — a job that never
// renders is free.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { submitCodaEdit, CODA_EDIT_COST, CODA_EDIT_TASKS, CODA_MODEL_VERSION } from '../../shared/codaEngine.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      task, src_audio_url, tags, lyrics, ref_audio_url,
      repaint_start, repaint_end, cover_strength, track_name, seed, title,
    } = await req.json();

    if (!CODA_EDIT_TASKS.includes(task)) {
      return Response.json({ error: `task must be one of: ${CODA_EDIT_TASKS.join(', ')}` }, { status: 400 });
    }
    if (!src_audio_url || !/^https:\/\//i.test(src_audio_url)) {
      return Response.json({ error: 'src_audio_url must be an https URL' }, { status: 400 });
    }
    if (task === 'repaint') {
      const s = Number(repaint_start), e = Number(repaint_end);
      if (!Number.isFinite(s) || !Number.isFinite(e) || s < 0 || e <= s) {
        return Response.json({ error: 'repaint requires repaint_start and repaint_end (seconds, end > start)' }, { status: 400 });
      }
    }
    if (task === 'extract' && !track_name) {
      return Response.json({ error: 'extract requires track_name (e.g. vocals, drums, bass)' }, { status: 400 });
    }

    // Credit gate — checked up front so a broke account never spends GPU time
    const credits = await base44.asServiceRole.entities.UserCredit.filter({ user_id: user.id });
    if ((credits[0]?.balance ?? 0) < CODA_EDIT_COST) {
      return Response.json({ error: `Insufficient credits — this task costs ${CODA_EDIT_COST}.` }, { status: 402 });
    }

    let engineJob;
    try {
      engineJob = await submitCodaEdit({
        task,
        srcAudioUrl: src_audio_url,
        tags,
        lyrics,
        refAudioUrl: ref_audio_url,
        repaintStart: task === 'repaint' ? Number(repaint_start) : undefined,
        repaintEnd: task === 'repaint' ? Number(repaint_end) : undefined,
        coverStrength: cover_strength,
        trackName: track_name,
        seed: Number(seed) || 42,
      });
    } catch (e) {
      return Response.json({ error: e.message }, { status: 502 });
    }

    const job = await base44.entities.GenerationJob.create({
      user_id: user.id,
      user_email: user.email,
      job_type: 'music',
      provider: 'harmonix',
      status: 'processing',
      provider_job_id: engineJob.jobId,
      started_at: new Date().toISOString(),
      ai_label: task === 'extract' ? 'ai_assisted' : 'ai_generated',
      input_data: {
        coda_edit: true,
        task,
        src_audio_url,
        ref_audio_url: ref_audio_url || null,
        tags: tags || '',
        lyrics: lyrics || '',
        repaint_start: task === 'repaint' ? Number(repaint_start) : null,
        repaint_end: task === 'repaint' ? Number(repaint_end) : null,
        cover_strength: task === 'cover' ? (Number(cover_strength) || 1.0) : null,
        track_name: track_name || null,
        seed: Number(seed) || 42,
        title: (title || '').slice(0, 120),
        engine: CODA_MODEL_VERSION,
        cost: CODA_EDIT_COST,
      },
    });

    return Response.json({ job_id: job.id, provider_job_id: engineJob.jobId, cost: CODA_EDIT_COST });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}