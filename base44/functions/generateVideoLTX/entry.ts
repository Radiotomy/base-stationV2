import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { prompt, duration = 5, aspect_ratio = '16:9', job_id } = await req.json();
    const apiKey = Deno.env.get('LTX_API_KEY');
    if (!apiKey) return Response.json({ error: 'API key not configured' }, { status: 500 });

    // Call LTX Video API - https://docs.ltx.video/welcome
    const ltxResponse = await fetch('https://api.ltx.video/v1/video/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt,
        duration,
        aspect_ratio,
        style: 'cinematic'
      })
    });

    if (!ltxResponse.ok) {
      const error = await ltxResponse.text();
      if (job_id) {
        await base44.asServiceRole.entities.GenerationJob.update(job_id, {
          status: 'failed',
          error_message: `LTX API error: ${error}`
        });
      }
      return Response.json({ error: 'Failed to generate video' }, { status: 500 });
    }

    const result = await ltxResponse.json();

    if (job_id) {
      await base44.asServiceRole.entities.GenerationJob.update(job_id, {
        status: 'completed',
        output_url: result.video_url,
        output_metadata: {
          duration,
          aspect_ratio,
          format: 'mp4'
        },
        provider_job_id: result.id,
        completed_at: new Date().toISOString()
      });
    }

    return Response.json({
      job_id,
      status: 'completed',
      video_url: result.video_url,
      duration,
      aspect_ratio
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});