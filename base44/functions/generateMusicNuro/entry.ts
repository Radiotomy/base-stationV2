import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { duration, mood, genre, style, lyrics, job_id } = await req.json();
    const apiKey = Deno.env.get('NURO_API_KEY');
    if (!apiKey) return Response.json({ error: 'API key not configured' }, { status: 500 });

    // Call Nuro API - https://docs.aimusicapi.ai/llms.txt (adjust endpoint as per docs)
    const nuroResponse = await fetch('https://api.nuro.ai/v1/music/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        duration,
        mood,
        genre,
        style,
        lyrics,
        output_format: 'mp3'
      })
    });

    if (!nuroResponse.ok) {
      const error = await nuroResponse.text();
      await base44.asServiceRole.entities.GenerationJob.update(job_id, {
        status: 'failed',
        error_message: `Nuro API error: ${error}`
      });
      return Response.json({ error: 'Failed to generate music' }, { status: 500 });
    }

    const result = await nuroResponse.json();

    const updated = await base44.asServiceRole.entities.GenerationJob.update(job_id, {
      status: 'completed',
      output_url: result.audio_url,
      output_metadata: {
        duration,
        bpm: result.bpm,
        key: result.key,
        mood,
        genre,
        style
      },
      provider_job_id: result.id,
      completed_at: new Date().toISOString()
    });

    return Response.json({
      job_id,
      status: 'completed',
      audio_url: result.audio_url,
      metadata: updated.output_metadata
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});