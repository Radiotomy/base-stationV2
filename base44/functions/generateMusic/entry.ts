import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// All aimusicapi.ai providers share one API key
const API_KEY          = Deno.env.get('SONIC_API_KEY') || Deno.env.get('NURO_API_KEY') || Deno.env.get('PRODUCER_API_KEY');
const SONIC_API_KEY    = API_KEY;
const NURO_API_KEY     = API_KEY;
const PRODUCER_API_KEY = API_KEY;
const TEMPCOLOR_API_KEY = Deno.env.get('TEMPCOLOR_API_KEY');

const AI_BASE = 'https://api.aimusicapi.ai/api/v1';

// ── Sonic ─────────────────────────────────────────────────────────────────────
// Docs: POST /api/v1/sonic/create
// Response: { code: 200, task_id: "uuid", message: "success" }
// Poll: GET /api/v1/sonic/task/{task_id}
//   → { code: 200, data: [ { clip_id, state: "pending"|"running"|"succeeded"|"failed", audio_url, image_url, ... } ] }
//
// Mode selection:
//   - With lyrics: custom_mode:true, prompt=lyrics, tags=genre+mood style descriptor
//   - No lyrics (Quick Gen): auto_lyrics:true + custom_mode:true — Sonic reads the full
//     sound_prompt directly as the style descriptor and auto-generates lyrics/tags from it.
//     This gives much better genre fidelity than custom_mode:false + gpt_description_prompt
//     which only uses the AI-parsed genre/mood tags and ignores the user's actual description.
//
// Model suitability: sonic-v3-5 and sonic-v4 have no vocal support and should not be used
// for vocal or auto-lyrics generation. Force a minimum of sonic-v4-5 for those cases.
async function generateWithSonic({ genre, mood, duration, sound_prompt, tempo, model, lyrics }) {
  // Ensure a vocal-capable model is used
  const LEGACY_MODELS = ['sonic-v3-5', 'sonic-v4'];
  const safeModel = (!model || LEGACY_MODELS.includes(model)) ? 'sonic-v4-5' : model;

  const tags = [genre, mood].filter(Boolean).join(', ');

  let body;
  if (lyrics && lyrics.trim().length > 0) {
    // Custom mode: user-provided lyrics with section tags
    body = {
      task_type: 'create_music',
      custom_mode: true,
      mv: safeModel,
      title: `${mood} ${genre} Track`,
      tags,
      prompt: lyrics.slice(0, 5000),
    };
  } else if (sound_prompt) {
    // Auto-lyrics mode: Sonic generates lyrics from the prompt
    body = {
      task_type: 'create_music',
      custom_mode: true,
      auto_lyrics: true,
      mv: safeModel,
      title: `${mood} ${genre} Track`,
      tags,
      prompt: sound_prompt.slice(0, 400),
    };
  } else {
    // AI description mode: simplest, just describe and let Sonic decide everything
    const desc = `A ${mood.toLowerCase()} ${genre} track${tempo ? ` at ${tempo} BPM` : ''}`.slice(0, 400);
    body = {
      task_type: 'create_music',
      custom_mode: false,
      mv: safeModel,
      gpt_description_prompt: desc,
    };
  }

  const sonicController = new AbortController();
  const sonicTimeout = setTimeout(() => sonicController.abort(), 25000);
  let res, data;
  try {
    res = await fetch(`${AI_BASE}/sonic/create`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SONIC_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: sonicController.signal,
    });
    data = await res.json();
  } finally {
    clearTimeout(sonicTimeout);
  }
  console.log('Sonic create response:', JSON.stringify(data));
  if (!res.ok) throw new Error(data.message || JSON.stringify(data));
  const taskId = data.task_id;
  if (!taskId) throw new Error('No task_id from Sonic: ' + JSON.stringify(data));
  return { task_id: taskId, provider: 'sonic' };
}

// ── Nuro ─────────────────────────────────────────────────────────────────────
// Vocal: POST /api/v1/nuro/create { type:"vocal", lyrics(required), genre(string enum), mood(string enum), duration(30-240) }
//   genre enum: Folk|Pop|Rock|"Hip Hop/Rap"|"R&B/Soul"|Electronic|Jazz|...
//   mood enum:  Happy|"Dynamic/Energetic"|Chill|Romantic|...
// BGM:   POST /api/v1/nuro/create { type:"bgm", description, genre(array of enum), mood(array of enum), duration(1-60), version }
//   genre array enum: pop|"hip hop"|"dance/edm"|jazz|rock|"chill out"|...
//   mood array enum:  energetic|happy|calm|intense|dramatic|uplifting|relaxed|...
// Poll:  GET  /api/v1/nuro/task/{task_id} → { task_id, status: "pending"|"running"|"succeeded", progress, audio_url }
async function generateWithNuro({ genre, mood, duration, nuro_version, lyrics, sound_prompt }) {
  const hasLyrics = lyrics && lyrics.trim().length > 0;

  let body;
  if (hasLyrics) {
    // Vocal mode — genre and mood are STRINGS matching the vocal enum
    const vocalGenreMap = {
      'Hip-Hop': 'Hip Hop/Rap', 'Trap': 'Hip Hop/Rap', 'Drill': 'Hip Hop/Rap',
      'R&B': 'R&B/Soul', 'Pop': 'Pop', 'Rock': 'Rock', 'Jazz': 'Jazz',
      'EDM': 'Electronic', 'House': 'Electronic', 'Lo-Fi': 'Folk',
      'Afrobeats': 'Pop', 'Ambient': 'Folk', 'Classical': 'Folk',
    };
    const vocalMoodMap = {
      'Energetic': 'Dynamic/Energetic', 'Chill': 'Chill', 'Happy': 'Happy',
      'Sad': 'Sorrow/Sad', 'Uplifting': 'Inspirational/Hopeful',
      'Romantic': 'Romantic', 'Dark': 'Sentimental/Melancholic/Lonely',
      'Melancholic': 'Sentimental/Melancholic/Lonely', 'Aggressive': 'Dynamic/Energetic',
    };
    body = {
      type: 'vocal',
      lyrics,
      genre: vocalGenreMap[genre] || 'Pop',
      mood: vocalMoodMap[mood] || 'Dynamic/Energetic',
      duration: Math.min(Math.max(duration || 120, 30), 240),
    };
  } else {
    // BGM / instrumental mode — genre and mood are ARRAYS matching the bgm enum
    const bgmGenreMap = {
      'Hip-Hop': 'hip hop', 'Trap': 'hip hop', 'Drill': 'hip hop',
      'EDM': 'dance/edm', 'House': 'dance/edm', 'Electronic': 'electronic',
      'Pop': 'pop', 'R&B': 'pop', 'Lo-Fi': 'chill out',
      'Jazz': 'jazz', 'Rock': 'rock', 'Afrobeats': 'world',
      'Ambient': 'ambient', 'Classical': 'orchestral',
    };
    const bgmMoodMap = {
      'Energetic': 'energetic', 'Chill': 'calm', 'Happy': 'happy',
      'Uplifting': 'uplifting', 'Dark': 'dramatic', 'Aggressive': 'intense',
      'Romantic': 'romantic', 'Sad': 'melancholy', 'Melancholic': 'melancholy',
    };
    body = {
      type: 'bgm',
      description: sound_prompt || `${mood} ${genre} instrumental music`,
      genre: [bgmGenreMap[genre] || 'pop'],
      mood: [bgmMoodMap[mood] || 'energetic'],
      duration: Math.min(Math.max(duration || 60, 1), 60),
      version: nuro_version || 'v2.0',
    };
  }

  const res = await fetch(`${AI_BASE}/nuro/create`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${NURO_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  console.log('Nuro create response:', JSON.stringify(data));
  if (!res.ok) throw new Error(data.message || JSON.stringify(data));
  const taskId = data.task_id;
  if (!taskId) throw new Error('No task_id from Nuro: ' + JSON.stringify(data));
  return { task_id: taskId, provider: 'nuro' };
}

// ── Producer ─────────────────────────────────────────────────────────────────
// Docs: POST /api/v1/producer/create
// Required: task_type: "create_music", plus sound and/or lyrics
// Poll: GET /api/v1/producer/task/{task_id} → { status: "PENDING"|"RUNNING"|"SUCCESS"|"FAILED", data: [{audio_url,...}] }
async function generateWithProducer({ genre, mood, sound_prompt, lyrics }) {
  const body = {
    task_type: 'create_music',
    sound: sound_prompt || `${mood} ${genre} music`,
    mv: 'FUZZ-2.0',
    title: `${mood} ${genre}`,
    ...(lyrics && { lyrics, make_instrumental: false }),
    ...(!lyrics && { make_instrumental: true }),
  };
  const res = await fetch(`${AI_BASE}/producer/create`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${PRODUCER_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || JSON.stringify(data));
  // Docs: response is { message: "success", task_id: "uuid" }
  const taskId = data.task_id;
  if (!taskId) throw new Error('No task_id from Producer: ' + JSON.stringify(data));
  return { task_id: taskId, provider: 'producer' };
}

// ── Tempolor ──────────────────────────────────────────────────────────────────
// Auth: Authorization header = raw API key (e.g. "Tempo-xxx-3w"), NOT Bearer
// Song:         POST /open-apis/v1/song/generate          { prompt, model, lyrics?, voice_id?, callback_url }
// Instrumental: POST /open-apis/v1/instrumental/generate  { prompt, model, callback_url }
// callback_url is required but we pass a no-op placeholder
const TEMPOLOR_BASE = 'https://api.tempolor.com/open-apis/v1';
async function generateWithTempolor({ genre, mood, sound_prompt, lyrics, model, tempolor_mode }) {
  const isInstrumental = tempolor_mode === 'instrumental' || !lyrics;
  const endpoint = isInstrumental ? `${TEMPOLOR_BASE}/instrumental/generate` : `${TEMPOLOR_BASE}/song/generate`;
  const defaultModel = isInstrumental ? 'TemPolor i3.5' : 'TemPolor v4.6';

  const body = isInstrumental
    ? {
        prompt: sound_prompt || `${mood} ${genre} instrumental music`,
        model: model || defaultModel,
        callback_url: 'https://webhook.site/tempolor-callback',
      }
    : {
        prompt: sound_prompt || `${mood} ${genre} music`,
        model: model || defaultModel,
        lyrics: lyrics || null,
        callback_url: 'https://webhook.site/tempolor-callback',
      };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  let res, data;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Authorization': TEMPCOLOR_API_KEY, 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    data = await res.json();
  } finally {
    clearTimeout(timeout);
  }
  console.log('Tempolor generate response:', JSON.stringify(data));
  if (!res.ok || data.status !== 200000) throw new Error(data.message || JSON.stringify(data));
  const itemId = data.data?.item_ids?.[0];
  if (!itemId) throw new Error('No item_id from Tempolor: ' + JSON.stringify(data));
  return { task_id: itemId, provider: 'tempcolor', tempolor_mode: isInstrumental ? 'instrumental' : 'song' };
}

// ── Loudly ────────────────────────────────────────────────────────────────────
// Base: https://soundtracks.loudly.com
// AI Prompt Generation: POST /api/ai/prompt/songs  (multipart/form-data)
//   Required: prompt (string) — text description of the desired song
//   Optional: duration (30-420s), model ('VEGA_1'|'VEGA_2'), structure_id (int)
// Response: { id, title, music_file_path, bpm, key: { name }, duration, ... }
// Synchronous — returns the song directly (no polling needed).
const LOUDLY_API_KEY = Deno.env.get('LOUDLY_API_KEY');

const LOUDLY_ENERGY_MAP = {
  'Energetic': 'high', 'Aggressive': 'high', 'Happy': 'high', 'Uplifting': 'high',
  'Chill': 'low', 'Melancholic': 'low', 'Romantic': 'low', 'Sad': 'low',
  'Dark': 'medium',
};

async function generateWithLoudly({ genre, mood, tempo, duration, sound_prompt, structure_id, model }) {
  // Build a descriptive text prompt from params — uses the new /api/ai/prompt/songs endpoint
  const energy = LOUDLY_ENERGY_MAP[mood] || 'medium';
  const bpmHint = tempo ? ` at ${tempo} BPM` : '';
  const prompt = sound_prompt
    ? `${sound_prompt}. ${mood} energy, ${genre} style${bpmHint}.`
    : `A ${energy}-energy ${mood.toLowerCase()} ${genre} track${bpmHint}.`;

  console.log('Loudly prompt:', prompt, '| duration:', duration);

  const form = new FormData();
  form.append('prompt', prompt);
  form.append('duration', String(Math.min(Math.max(duration || 30, 30), 420)));
  form.append('model', model || 'VEGA_2');

  const res = await fetch('https://soundtracks.loudly.com/api/ai/prompt/songs', {
    method: 'POST',
    headers: { 'API-KEY': LOUDLY_API_KEY },
    body: form,
  });
  const data = await res.json();
  console.log('Loudly prompt/songs response:', JSON.stringify(data));
  if (!res.ok) throw new Error(data.error || data.message || `Loudly error ${res.status}`);
  const audioUrl = data.music_file_path || data.audio_url;
  if (!audioUrl) throw new Error('Loudly returned no audio URL: ' + JSON.stringify(data));
  return {
    audio_url: audioUrl,
    bpm: data.bpm,
    key: data.key?.name || data.key,
    provider: 'loudly', credits_used: 1,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { provider = 'sonic', duration = 60, mood = 'Energetic', genre = 'Hip-Hop',
            tempo, sound_prompt, lyrics, model, nuro_version, tempolor_mode, structure_id } = await req.json();

    // Call provider FIRST — before any DB writes — so gateway timeout isn't wasted on DB ops
    let providerResult;
    try {
      if (provider === 'loudly' && LOUDLY_API_KEY)
        providerResult = await generateWithLoudly({ genre, mood, tempo, duration, sound_prompt, structure_id, model });
      else if (provider === 'nuro')
        providerResult = await generateWithNuro({ genre, mood, duration, nuro_version, lyrics });
      else if (provider === 'producer')
        providerResult = await generateWithProducer({ genre, mood, sound_prompt, lyrics });
      else if (provider === 'tempcolor')
        providerResult = await generateWithTempolor({ genre, mood, sound_prompt, lyrics, model, tempolor_mode });
      else // default: sonic
        providerResult = await generateWithSonic({ genre, mood, duration, sound_prompt, tempo: tempo || undefined, model, lyrics });
    } catch (providerErr) {
      return Response.json({ error: providerErr.message }, { status: 502 });
    }

    const generatedAt = new Date().toISOString();
    // Determine exact model version used per provider
    const modelVersionMap = {
      loudly: model || 'VEGA_2',
      sonic: (() => { const LEGACY = ['sonic-v3-5', 'sonic-v4']; return (!model || LEGACY.includes(model)) ? 'sonic-v4-5' : model; })(),
      nuro: nuro_version || 'v2.0',
      producer: 'FUZZ-2.0',
      tempcolor: model || (tempolor_mode === 'instrumental' ? 'TemPolor i3.5' : 'TemPolor v4.6'),
    };
    const modelVersion = modelVersionMap[provider] || provider;

    // Simple content fingerprint for immutability/provenance
    const fingerprintData = `${user.id}|${provider}|${modelVersion}|${mood}|${genre}|${sound_prompt || ''}|${generatedAt}`;
    const encoder = new TextEncoder();
    const hashBuf = await crypto.subtle.digest('SHA-256', encoder.encode(fingerprintData));
    const contentHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    const logMetadata = {
      model_version: modelVersion,
      input_parameters: { duration, mood, genre, tempo, sound_prompt: (sound_prompt || '').slice(0, 200), has_lyrics: !!(lyrics && lyrics.trim()) },
      provider_job_id: providerResult.task_id || null,
      generated_timestamp: generatedAt,
      content_hash: contentHash,
    };

    // Synchronous result (e.g., Loudly) — persist and return immediately
    if (providerResult.audio_url) {
      const jobRecord = await base44.entities.GenerationJob.create({
        user_id: user.id, user_email: user.email,
        job_type: 'music', provider,
        status: 'completed',
        input_data: { duration, mood, genre, tempo, sound_prompt },
        output_url: providerResult.audio_url,
        output_metadata: { bpm: providerResult.bpm, key: providerResult.key, duration },
        credits_used: providerResult.credits_used || 1,
        started_at: generatedAt,
        completed_at: generatedAt,
      }).catch(() => ({ id: null }));

      base44.asServiceRole.entities.APIUsageLog.create({
        user_id: user.id, user_email: user.email, user_name: user.full_name,
        provider, task: 'generate_music',
        credits_used: providerResult.credits_used || 1,
        status: 'success',
        timestamp: generatedAt,
        job_id: jobRecord?.id || null,
        metadata: {
          ...logMetadata,
          output_details: {
            audio_url: providerResult.audio_url,
            bpm: providerResult.bpm,
            key: providerResult.key,
            duration,
          },
        },
      }).catch(() => {});

      return Response.json({
        status: 'completed',
        audio_url: providerResult.audio_url,
        bpm: providerResult.bpm, key: providerResult.key,
      });
    }

    // Async (Sonic, Nuro, Producer, Tempolor): create job record with provider task_id
    const job = await base44.entities.GenerationJob.create({
      user_id: user.id, user_email: user.email,
      job_type: 'music', provider,
      status: 'processing',
      input_data: { duration, mood, genre, tempo, sound_prompt },
      provider_job_id: providerResult.task_id,
      started_at: generatedAt,
    });

    // Create pending log — will be finalized by pollGenerationJob on completion
    base44.asServiceRole.entities.APIUsageLog.create({
      user_id: user.id, user_email: user.email, user_name: user.full_name,
      provider, task: 'generate_music',
      credits_used: 0,
      status: 'pending',
      timestamp: generatedAt,
      job_id: job.id,
      metadata: { ...logMetadata, base44_job_id: job.id },
    }).catch(() => {});

    return Response.json({ job_id: job.id, status: 'processing' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});