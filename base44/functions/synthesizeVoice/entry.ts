import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Voice synthesis using Nuro API
// POST: { text, persona_name, voice_type, accent, characteristics, speed, pitch }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      text,
      persona_name = 'Default Voice',
      voice_type = 'male',
      accent = 'neutral',
      characteristics = [],
      speed = 1.0,
      pitch = 0,
    } = await req.json();

    if (!text) return Response.json({ error: 'Missing text' }, { status: 400 });

    const nuroKey = Deno.env.get('NURO_API_KEY');
    if (!nuroKey) return Response.json({ error: 'NURO_API_KEY not configured' }, { status: 500 });

    const charDesc = characteristics.length > 0 ? characteristics.join(', ') : 'clear and natural';
    const voicePrompt = `${voice_type} voice, ${accent} accent, ${charDesc} tone`;

    // Nuro API TTS endpoint
    const response = await fetch('https://api.nuro.ai/v1/tts/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${nuroKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        voice_prompt: voicePrompt,
        voice_type,
        accent,
        speed,
        pitch,
        format: 'mp3',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Nuro TTS error:', response.status, errText.slice(0, 200));
      // Return informative error — endpoint may need adjustment per actual Nuro docs
      return Response.json({
        error: `Voice synthesis API returned ${response.status}. Please verify the Nuro API TTS endpoint is available on your plan.`,
        details: errText.slice(0, 300),
      }, { status: 502 });
    }

    const data = await response.json();

    // Log usage
    await base44.asServiceRole.entities.APIUsageLog.create({
      user_id: user.id,
      user_email: user.email,
      provider: 'nuro',
      task: 'synthesize_voice',
      credits_used: data.credits_used || 2,
      status: 'success',
      timestamp: new Date().toISOString(),
    });

    return Response.json({
      audio_url: data.audio_url || data.output_url,
      task_id: data.task_id,
      duration: data.duration,
      persona_name,
      message: 'Voice synthesis complete',
    });
  } catch (error) {
    console.error('synthesizeVoice error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});