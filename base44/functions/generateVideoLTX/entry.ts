import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const LTX_API_KEY = Deno.env.get('LTX_API_KEY');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (!LTX_API_KEY) return Response.json({ error: 'LTX_API_KEY not configured' }, { status: 500 });

    const { prompt, duration = 5, aspect_ratio = '16:9' } = await req.json();
    if (!prompt) return Response.json({ error: 'Missing prompt' }, { status: 400 });

    // Create job record
    const job = await base44.entities.GenerationJob.create({
      user_id: user.id, user_email: user.email,
      job_type: 'video', provider: 'ltx',
      status: 'processing',
      input_data: { prompt, duration, aspect_ratio },
      started_at: new Date().toISOString(),
    });

    // Call LTX Video API
    const ltxRes = await fetch('https://api.ltx.video/v1/video/generate', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LTX_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, duration, aspect_ratio, style: 'cinematic' }),
    });

    if (!ltxRes.ok) {
      const errText = await ltxRes.text();
      await base44.entities.GenerationJob.update(job.id, { status: 'failed', error_message: errText });
      return Response.json({ error: 'LTX error: ' + errText }, { status: 502 });
    }

    const result = await ltxRes.json();

    // If synchronous response with video_url
    if (result.video_url) {
      await base44.entities.GenerationJob.update(job.id, {
        status: 'completed',
        output_url: result.video_url,
        output_metadata: { duration, aspect_ratio, format: 'mp4' },
        completed_at: new Date().toISOString(),
      });

      await base44.asServiceRole.entities.APIUsageLog.create({
        user_id: user.id, user_email: user.email, user_name: user.full_name,
        provider: 'ltx', task: 'generate_video',
        credits_used: duration * 2, status: 'success',
        timestamp: new Date().toISOString(), job_id: job.id,
      }).catch(() => {});

      return Response.json({ job_id: job.id, status: 'completed', video_url: result.video_url, duration, aspect_ratio });
    }

    // Async task
    if (result.task_id || result.id) {
      const providerJobId = result.task_id || result.id;
      await base44.entities.GenerationJob.update(job.id, {
        status: 'processing', provider_job_id: providerJobId,
      });
      return Response.json({ job_id: job.id, provider_job_id: providerJobId, status: 'processing' });
    }

    await base44.entities.GenerationJob.update(job.id, { status: 'failed', error_message: 'No output received' });
    return Response.json({ error: 'No output received from LTX' }, { status: 502 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});