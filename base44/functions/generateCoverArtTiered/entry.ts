import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { track_title, mood, style, tier = 'auto', job_id } = await req.json();
    const apiKey = Deno.env.get('TEMPCOLOR_API_KEY');
    if (!apiKey) return Response.json({ error: 'API key not configured' }, { status: 500 });

    // Tiered strategy: 'auto' = low-cost, 'deep' = higher quality
    const qualityTier = tier === 'deep' ? 'high' : 'standard';
    const credits = tier === 'deep' ? 50 : 10; // Estimated credit costs

    // Call Tempcolor API - https://platform.tempolor.com/docs
    const tempcolorResponse = await fetch('https://api.tempolor.com/v1/image/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: `Album cover art for "${track_title}", mood: ${mood}, style: ${style}`,
        width: 1024,
        height: 1024,
        quality: qualityTier,
        format: 'png'
      })
    });

    if (!tempcolorResponse.ok) {
      const error = await tempcolorResponse.text();
      await base44.asServiceRole.entities.GenerationJob.update(job_id, {
        status: 'failed',
        error_message: `Tempcolor API error: ${error}`
      });
      return Response.json({ error: 'Failed to generate cover art' }, { status: 500 });
    }

    const result = await tempcolorResponse.json();

    const updated = await base44.asServiceRole.entities.GenerationJob.update(job_id, {
      status: 'completed',
      output_url: result.image_url,
      output_metadata: {
        tier,
        quality: qualityTier,
        mood,
        style
      },
      credits_used: credits,
      provider_job_id: result.id,
      completed_at: new Date().toISOString()
    });

    return Response.json({
      job_id,
      status: 'completed',
      image_url: result.image_url,
      credits_used: credits,
      tier: qualityTier
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});