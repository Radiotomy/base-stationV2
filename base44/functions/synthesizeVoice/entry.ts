import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Voice synthesis via ElevenLabs Text-to-Speech (replaces the retired Nuro TTS API).
// Docs: POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id} — returns MP3 bytes.
// Request contract unchanged: { text, persona_name, voice_type, accent, characteristics, speed, pitch, voice_id? }
// Premade ElevenLabs voice IDs mapped by voice_type + accent:
const VOICE_MAP = {
  male:    { american: 'pNInz6obpgDQGcFmaJgB', british: 'JBFqnCBsd6RMkjVDRZzb', australian: 'IKne3meq5aSn9XLyUdCD', default: 'pNInz6obpgDQGcFmaJgB' }, // Adam / George / Charlie
  female:  { american: '21m00Tcm4TlvDq8ikWAM', british: 'Xb7hH8MSUJpSbSDYk0k2', default: 'EXAVITQu4vr4xnSDxMaL' }, // Rachel / Alice / Sarah
  neutral: { default: 'SAz9YHcvj6GT2YYXdXww' }, // River
};

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
      voice_id: explicitVoiceId,
    } = await req.json();

    if (!text) return Response.json({ error: 'Missing text' }, { status: 400 });

    const key = Deno.env.get('ELEVENLABS_API');
    if (!key) return Response.json({ error: 'ELEVENLABS_API not configured' }, { status: 500 });

    const typeMap = VOICE_MAP[voice_type] || VOICE_MAP.male;
    const voiceId = explicitVoiceId || typeMap[accent] || typeMap.default;

    // Characteristics steer the delivery via stability/style settings:
    // expressive traits → lower stability; monotone/calm → higher stability.
    const traits = (characteristics || []).map((c) => String(c).toLowerCase());
    const expressive = traits.some((t) => ['energetic', 'dramatic', 'raspy', 'breathy', 'playful', 'emotional'].includes(t));
    const calm = traits.some((t) => ['monotone', 'calm', 'smooth', 'soft'].includes(t));
    const stability = calm ? 0.75 : expressive ? 0.3 : 0.5;

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: String(text).slice(0, 5000),
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability,
          similarity_boost: 0.75,
          speed: Math.max(0.7, Math.min(1.2, Number(speed) || 1.0)),
        },
      }),
    });

    if (!res.ok) {
      let detail = '';
      try {
        const j = await res.json();
        detail = j?.detail?.message || (typeof j?.detail === 'string' ? j.detail : JSON.stringify(j.detail || j));
      } catch { detail = ''; }
      console.error('ElevenLabs TTS error:', res.status, detail);
      return Response.json({
        error: `Voice synthesis failed: ${detail || `ElevenLabs HTTP ${res.status}`}`,
      }, { status: 502 });
    }

    const bytes = await res.arrayBuffer();
    const file = new File([bytes], `voice-${Date.now()}.mp3`, { type: 'audio/mpeg' });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    await base44.asServiceRole.entities.APIUsageLog.create({
      user_id: user.id, user_email: user.email, user_name: user.full_name,
      provider: 'elevenlabs',
      task: 'synthesize_voice',
      credits_used: 2,
      status: 'success',
      timestamp: new Date().toISOString(),
      metadata: { model_version: 'eleven_multilingual_v2', voice_id: voiceId, voice_type, accent },
    }).catch(() => {});

    return Response.json({
      audio_url: file_url,
      voice_id: voiceId,
      persona_name,
      message: 'Voice synthesis complete',
    });
  } catch (error) {
    console.error('synthesizeVoice error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});