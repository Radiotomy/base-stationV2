import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { synthesizeInworldSpeech } from '../../shared/inworldTts.ts';

// Inworld character voices mapped by voice_type — the same engine ORVO's
// voiceovers and AI-cast shows already speak through.
const INWORLD_VOICE_MAP = { male: 'Hades', female: 'Ashley', neutral: 'Dennis' };

// Voice synthesis via ElevenLabs Text-to-Speech (replaces the retired Nuro TTS API).
// Docs: POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id} — returns MP3 bytes.
// Request contract unchanged: { text, persona_name, voice_type, accent, characteristics, speed, pitch, voice_id? }
const VOICE_SYNTH_COST = 2;
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
      provider = 'elevenlabs',
    } = await req.json();

    if (!text) return Response.json({ error: 'Missing text' }, { status: 400 });

    const useInworld = provider === 'inworld';
    const key = Deno.env.get(useInworld ? 'INWORLD_API_KEY' : 'ELEVENLABS_API');
    if (!key) {
      return Response.json({
        error: `${useInworld ? 'INWORLD_API_KEY' : 'ELEVENLABS_API'} not configured`,
      }, { status: 500 });
    }

    // ── Server-side credit gate (this was previously logged but never deducted) ──
    const creditRecs = await base44.asServiceRole.entities.UserCredit.filter({ user_id: user.id });
    let creditRecord = creditRecs[0];
    const balance = creditRecord?.balance ?? 0;
    if (balance < VOICE_SYNTH_COST) {
      return Response.json({
        error: 'Insufficient credits',
        required: VOICE_SYNTH_COST, balance,
        message: `Voice synthesis costs ${VOICE_SYNTH_COST} credits. You have ${balance}.`,
      }, { status: 402 });
    }

    const typeMap = VOICE_MAP[voice_type] || VOICE_MAP.male;
    const voiceId = useInworld
      ? (explicitVoiceId || INWORLD_VOICE_MAP[voice_type] || INWORLD_VOICE_MAP.neutral)
      : (explicitVoiceId || typeMap[accent] || typeMap.default);

    // Characteristics steer the delivery via stability/style settings:
    // expressive traits → lower stability; monotone/calm → higher stability.
    const traits = (characteristics || []).map((c) => String(c).toLowerCase());
    const expressive = traits.some((t) => ['energetic', 'dramatic', 'raspy', 'breathy', 'playful', 'emotional'].includes(t));
    const calm = traits.some((t) => ['monotone', 'calm', 'smooth', 'soft'].includes(t));
    const stability = calm ? 0.75 : expressive ? 0.3 : 0.5;

    // Inworld path: one REST call returning MP3 bytes. It has no stability /
    // similarity controls, so the trait steering below simply doesn't apply.
    let inworldBytes = null;
    if (useInworld) {
      inworldBytes = await synthesizeInworldSpeech(key, { text: String(text).slice(0, 5000), voiceId });
    }

    const res = useInworld ? null : await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
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

    if (res && !res.ok) {
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

    const bytes = inworldBytes || await res.arrayBuffer();
    const file = new File([bytes], `voice-${Date.now()}.mp3`, { type: 'audio/mpeg' });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    // ── Deduct credits now that generation succeeded ──
    if (!creditRecord) {
      creditRecord = await base44.asServiceRole.entities.UserCredit.create({
        user_id: user.id, user_email: user.email,
        balance: 0, lifetime_earned: 0, lifetime_spent: 0,
      });
    }
    const newBalance = Math.max(0, (creditRecord.balance || 0) - VOICE_SYNTH_COST);
    await base44.asServiceRole.entities.UserCredit.update(creditRecord.id, {
      balance: newBalance,
      lifetime_spent: (creditRecord.lifetime_spent || 0) + VOICE_SYNTH_COST,
      monthly_used: (creditRecord.monthly_used || 0) + VOICE_SYNTH_COST,
    });
    await base44.asServiceRole.entities.CreditLog.create({
      user_id: user.id, user_email: user.email,
      transaction_type: 'generation',
      amount: -VOICE_SYNTH_COST,
      balance_before: creditRecord.balance,
      balance_after: newBalance,
      provider: useInworld ? 'inworld' : 'elevenlabs',
      description: `Voice synthesis${persona_name ? ` — ${persona_name}` : ''}`,
    }).catch(() => {});

    await base44.asServiceRole.entities.APIUsageLog.create({
      user_id: user.id, user_email: user.email, user_name: user.full_name,
      provider: useInworld ? 'inworld' : 'elevenlabs',
      task: 'synthesize_voice',
      credits_used: VOICE_SYNTH_COST,
      status: 'success',
      timestamp: new Date().toISOString(),
      metadata: {
        model_version: useInworld ? 'inworld-tts-1' : 'eleven_multilingual_v2',
        voice_id: voiceId, voice_type, accent,
      },
    }).catch(() => {});

    return Response.json({
      audio_url: file_url,
      provider: useInworld ? 'inworld' : 'elevenlabs',
      voice_id: voiceId,
      persona_name,
      credits_used: VOICE_SYNTH_COST,
      credits_remaining: newBalance,
      message: 'Voice synthesis complete',
    });
  } catch (error) {
    console.error('synthesizeVoice error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});