import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { duration, mood, genre, tempo, job_id } = await req.json();
    const apiKey = Deno.env.get('LOUDLY_API_KEY');
    if (!apiKey) return Response.json({ error: 'API key not configured' }, { status: 500 });

    // Call Loudly API - https://www.loudly.com/developers
    const loudlyResponse = await fetch('https://api.loudly.com/v1/music/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        duration: duration || 30,
        mood,
        genre,
        tempo,
        format: 'mp3'
      })
    });

    if (!loudlyResponse.ok) {
      const error = await loudlyResponse.text();
      await base44.asServiceRole.entities.GenerationJob.update(job_id, {
        status: 'failed',
        error_message: `Loudly API error: ${error}`
      });
      return Response.json({ error: 'Failed to generate music' }, { status: 500 });
    }

    const result = await loudlyResponse.json();

    // Update job with output
    const updated = await base44.asServiceRole.entities.GenerationJob.update(job_id, {
      status: 'completed',
      output_url: result.audio_url,
      output_metadata: {
        duration,
        bpm: result.bpm,
        key: result.key,
        mood,
        genre
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