import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchPolishUpload } from '../../shared/loopPolish.ts';

// Runs the SoundForge finishing stage on a PCM WAV that was decoded client-side.
//
// Stable Audio returns MP3 and this runtime can't decode it, so the browser does
// the decode and posts the resulting WAV here. The polish itself stays on the
// server: it's the same shared module every other provider goes through, so a
// loop is finished identically no matter which engine produced it.
//
// Charges nothing — the generation was already billed. This only finishes it.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { job_id, wav_url, bpm, category = 'loop' } = await req.json();
    if (!job_id || !wav_url) {
      return Response.json({ error: 'job_id and wav_url are required' }, { status: 400 });
    }

    const job = await base44.asServiceRole.entities.GenerationJob.get(job_id);
    if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });
    if (job.user_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const name = job.input_data?.prompt?.slice(0, 60) || 'soundforge';
    const { file_url, info, skipped } = await fetchPolishUpload(base44, wav_url, name, {
      bpm: bpm ? Number(bpm) : job.input_data?.bpm || null,
      category,
    });

    await base44.asServiceRole.entities.GenerationJob.update(job_id, {
      output_url: file_url,
      output_metadata: {
        ...(job.output_metadata || {}),
        duration: info?.duration_seconds || job.output_metadata?.duration,
        loop: info || null,
      },
    });

    return Response.json({ audio_url: file_url, loop: info, skipped });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});