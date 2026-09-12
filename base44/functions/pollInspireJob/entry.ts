// pollInspireJob — one status read for an Inspire (InspireMusic) render. On
// completion it persists the WAV into Base44 storage, generates cover art, saves
// the track to the creator's library, deducts credits and flips the job to
// 'completed'.
//
// Idempotent: a settled job returns its cached result and never re-charges or
// re-saves. Called by the studio, by the notification watchdog and by the
// server-side stuck-job sweep, so it must stay safe to call at any time.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { getInspireStatus, persistInspireWav, inspireDeduct } from '../../shared/inspireEngine.ts';
import { generateTrackCover } from '../../shared/trackCoverArt.ts';
import { cosForJob } from '../../shared/cosStamp.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { job_id } = await req.json();
    if (!job_id) return Response.json({ error: 'job_id is required' }, { status: 400 });

    const job = await base44.entities.GenerationJob.get(job_id).catch(() => null);
    if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });
    if (job.user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (job.status === 'completed') {
      return Response.json({
        status: 'completed', job_id: job.id,
        audio_url: job.output_url,
        cover_image_url: job.output_metadata?.cover_image_url || null,
        asset_id: job.output_metadata?.asset_id || null,
        sample_rate: job.output_metadata?.sample_rate || null,
      });
    }
    if (job.status === 'failed') {
      return Response.json({ status: 'failed', job_id: job.id, error: job.error_message || 'Generation failed' });
    }

    let st;
    try {
      st = await getInspireStatus(job.provider_job_id);
    } catch (err) {
      // A 404 means the Space restarted and lost this render. Left 'processing'
      // the job would spin forever, so it fails cleanly and costs nothing.
      if (/HTTP 404/.test(err.message)) {
        const detail = 'Inspire engine restarted mid-render and lost this job — please resubmit (no credits were charged).';
        await base44.entities.GenerationJob.update(job.id, {
          status: 'failed', error_message: detail, completed_at: new Date().toISOString(),
        });
        return Response.json({ status: 'failed', job_id: job.id, error: detail });
      }
      return Response.json({ status: 'processing', job_id: job.id, progress: 'Rendering…' });
    }

    if (st.status === 'failed' || st.status === 'error') {
      const detail = st.error || st.progress || 'Inspire generation failed';
      await base44.entities.GenerationJob.update(job.id, {
        status: 'failed', error_message: detail, completed_at: new Date().toISOString(),
      });
      return Response.json({ status: 'failed', job_id: job.id, error: detail });
    }

    if (st.status !== 'completed') {
      return Response.json({
        status: 'processing', job_id: job.id,
        progress: st.progress || 'Running InspireMusic inference…',
      });
    }

    if (!st.downloadUrl) {
      await base44.entities.GenerationJob.update(job.id, {
        status: 'failed',
        error_message: 'Engine reported completed but returned no download URL',
        completed_at: new Date().toISOString(),
      });
      return Response.json({ status: 'failed', job_id: job.id, error: 'No output URL' });
    }

    const isContinuation = job.input_data?.task === 'continuation';
    const title = (job.input_data?.title || '').trim()
      || (isContinuation && job.input_data?.continuation_source_title
        ? `${job.input_data.continuation_source_title} (Continued)`
        : String(job.input_data?.prompt || 'Inspire Track').split(',')[0].slice(0, 60))
      || 'Inspire Track';

    let persisted;
    try {
      persisted = await persistInspireWav(
        base44, st.downloadUrl, title, Number(job.input_data?.duration) || 0,
      );
    } catch (err) {
      await base44.entities.GenerationJob.update(job.id, {
        status: 'failed', error_message: err.message, completed_at: new Date().toISOString(),
      });
      return Response.json({ status: 'failed', job_id: job.id, error: err.message });
    }

    const fileUrl = persisted.fileUrl;
    const completedAt = new Date().toISOString();

    const coverUrl = await generateTrackCover(base44, {
      title, prompt: job.input_data?.prompt || '',
    });

    const { fields: cos } = cosForJob({ input_data: job.input_data || {} });

    // A continuation's label is decided at submit (the creator's own recording is
    // in the output) and must win over whatever the prompt-only COS heuristic
    // would infer — otherwise an assisted recording is disclosed as fully generated.
    const aiLabel = job.ai_label || (isContinuation ? 'ai_assisted' : 'ai_generated');

    const asset = await base44.entities.UserAsset.create({
      user_id: user.id, user_email: user.email,
      asset_type: 'track',
      title,
      file_url: fileUrl,
      thumbnail_url: coverUrl || '',
      is_public: false,
      ...cos,
      ai_label: aiLabel,
      ai_disclosure_label: aiLabel,
      ai_disclosure_basis: isContinuation
        ? `Composed by Inspire (our InspireMusic engine) as a continuation of the creator's own recording "${job.input_data?.continuation_source_title || 'untitled'}". ${cos.ai_disclosure_basis}`
        : `Generated end-to-end by Inspire (our InspireMusic engine) from a written description. ${cos.ai_disclosure_basis}`,
      // Derived work: the continuation's parent is recorded so the provenance
      // chain leads back to the source recording instead of dead-ending here.
      ...(isContinuation && job.input_data?.continuation_asset_id
        ? { parent_asset_id: job.input_data.continuation_asset_id }
        : {}),
      metadata: {
        provider: 'inspire', engine: 'hf_space',
        model: job.input_data?.model || 'InspireMusic-1.5B-Long',
        model_family: 'InspireMusic (Inspire)',
        task: job.input_data?.task || 'text-to-music',
        prompt: job.input_data?.prompt || '',
        section: job.input_data?.section || '',
        genre: job.input_data?.genre || null,
        mood: job.input_data?.mood || null,
        instrumental: true,
        continuation_source_asset_id: job.input_data?.continuation_asset_id || '',
        continuation_source_title: job.input_data?.continuation_source_title || '',
        duration: job.input_data?.duration,
        seed: job.input_data?.seed ?? null,
        format: 'wav',
        sample_rate: persisted.sampleRate,
        channels: persisted.channels,
        bit_depth: persisted.bitDepth,
        generated_at: completedAt,
        generation_job_id: job.id,
      },
    }).catch((e) => { console.warn('Asset save failed:', e.message); return null; });

    await base44.entities.GenerationJob.update(job.id, {
      status: 'completed',
      output_url: fileUrl,
      output_metadata: {
        format: 'wav',
        model_version: job.input_data?.model || 'InspireMusic-1.5B-Long',
        sample_rate: persisted.sampleRate,
        channels: persisted.channels,
        duration: job.input_data?.duration,
        asset_id: asset?.id || null,
        cover_image_url: coverUrl || null,
        title,
      },
      credits_used: job.input_data?.credit_cost || 0,
      completed_at: completedAt,
    });

    const cost = job.input_data?.credit_cost || 0;
    let remaining = null;
    if (cost > 0) remaining = await inspireDeduct(base44, user, cost, job.id);

    return Response.json({
      status: 'completed', job_id: job.id,
      audio_url: fileUrl,
      cover_image_url: coverUrl || null,
      asset_id: asset?.id || null,
      sample_rate: persisted.sampleRate,
      credits_used: cost,
      credits_remaining: remaining,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});