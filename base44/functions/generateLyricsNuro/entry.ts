import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { topic, mood, style, length = 'medium', job_id } = await req.json();
    const apiKey = Deno.env.get('NURO_API_KEY');
    if (!apiKey) return Response.json({ error: 'API key not configured' }, { status: 500 });

    // Call Nuro for advanced lyric generation
    const nuroResponse = await fetch('https://api.nuro.ai/v1/lyrics/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        topic,
        mood,
        style,
        length,
        structure: 'verse-chorus-verse'
      })
    });

    if (!nuroResponse.ok) {
      const error = await nuroResponse.text();
      await base44.asServiceRole.entities.GenerationJob.update(job_id, {
        status: 'failed',
        error_message: `Nuro Lyrics API error: ${error}`
      });
      return Response.json({ error: 'Failed to generate lyrics' }, { status: 500 });
    }

    const result = await nuroResponse.json();

    const updated = await base44.asServiceRole.entities.GenerationJob.update(job_id, {
      status: 'completed',
      output_metadata: {
        lyrics: result.lyrics,
        structure: result.structure,
        theme: topic,
        mood,
        style
      },
      provider_job_id: result.id,
      completed_at: new Date().toISOString()
    });

    return Response.json({
      job_id,
      status: 'completed',
      lyrics: result.lyrics,
      structure: result.structure
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});