import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// All aimusicapi.ai providers share one API key
const API_KEY          = Deno.env.get('SONIC_API_KEY') || Deno.env.get('NURO_API_KEY') || Deno.env.get('PRODUCER_API_KEY');
const SONIC_API_KEY    = API_KEY;
const NURO_API_KEY     = API_KEY;
const PRODUCER_API_KEY = API_KEY;
const TEMPCOLOR_API_KEY = Deno.env.get('TEMPCOLOR_API_KEY');

const AI_BASE = 'https://api.aimusicapi.ai/api/v1';

// ── Sonic (description mode — no lyrics required) ────────────────────────────
async function generateWithSonic({ genre, mood, duration, sound_prompt, tempo, model }) {
  const tags = [genre, mood, tempo ? `${tempo}bpm` : null].filter(Boolean).join(', ');
  const res = await fetch(`${AI_BASE}/sonic/create`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SONIC_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      custom_mode: false,
      mv: model || 'sonic-v4-5',
      title: `${mood} ${genre} Track`,
      tags,
      gpt_description_prompt: sound_prompt || `A ${mood.toLowerCase()} ${genre} track at ${tempo || 120} BPM`,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || JSON.stringify(data));
  // Returns task_id array
  const taskId = Array.isArray(data) ? data[0]?.id : data.task_id || data.id;
  if (!taskId) throw new Error('No task_id from Sonic');
  return { task_id: taskId, provider: 'sonic' };
}

// ── Nuro ─────────────────────────────────────────────────────────────────────
// vocal: POST /api/v1/nuro/create { type:"vocal", lyrics, genre(str), mood(str), duration }
// bgm:   POST /api/v1/nuro/create { type:"bgm", description, genre(arr), mood(arr), duration, version }
// Poll:  GET  /api/v1/nuro/task/{task_id} → { status: "pending"|"running"|"succeeded", audio_url }
async function generateWithNuro({ genre, mood, duration, nuro_version, lyrics, sound_prompt }) {
  const hasLyrics = lyrics && lyrics.trim().length > 0;

  let body;
  if (hasLyrics) {
    // Vocal mode — needs lyrics, genre/mood are strings
    body = {
      type: 'vocal',
      lyrics,
      genre: genre || 'Pop',
      mood: mood || 'Dynamic/Energetic',
      duration: Math.min(Math.max(duration || 120, 30), 240),
    };
  } else {
    // BGM / instrumental mode — uses description, genre/mood are arrays
    const genreMap = {
      'Hip-Hop': 'hip hop', 'EDM': 'dance/edm', 'Pop': 'pop', 'R&B': 'pop',
      'Lo-Fi': 'chill out', 'Jazz': 'jazz', 'Rock': 'rock', 'Trap': 'hip hop',
    };
    const moodMap = {
      'Energetic': 'energetic', 'Chill': 'calm', 'Dark': 'dramatic',
      'Happy': 'happy', 'Uplifting': 'uplifting', 'Aggressive': 'intense',
    };
    body = {
      type: 'bgm',
      description: sound_prompt || `${mood} ${genre} instrumental music`,
      genre: [genreMap[genre] || 'pop'],
      mood: [moodMap[mood] || 'energetic'],
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
  if (!res.ok) throw new Error(data.message || JSON.stringify(data));
  const taskId = data.task_id || data.id;
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
const TEMPOLOR_BASE = 'https://api.tempolor.com/open-apis/v1';
async function generateWithTempolor({ genre, mood, sound_prompt, lyrics, model, tempolor_mode }) {
  const isInstrumental = tempolor_mode === 'instrumental';
  const endpoint = isInstrumental ? `${TEMPOLOR_BASE}/instrumental/generate` : `${TEMPOLOR_BASE}/song/generate`;
  const defaultModel = isInstrumental ? 'TemPolor i3.5' : 'TemPolor v4.6';
  const body = isInstrumental
    ? { prompt: sound_prompt || `${mood} ${genre} instrumental music`, model: model || defaultModel, callback_url: 'https://placeholder.invalid/cb' }
    : { prompt: sound_prompt || `${mood} ${genre} music`, model: model || defaultModel, lyrics: lyrics || null, callback_url: 'https://placeholder.invalid/cb' };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Authorization': TEMPCOLOR_API_KEY, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || data.status !== 200000) throw new Error(data.message || JSON.stringify(data));
  const itemId = data.data?.item_ids?.[0];
  if (!itemId) throw new Error('No item_id from Tempolor');
  return { task_id: itemId, provider: 'tempcolor', tempolor_mode: isInstrumental ? 'instrumental' : 'song' };
}

// ── Loudly (if key available) ─────────────────────────────────────────────────
const LOUDLY_API_KEY = Deno.env.get('LOUDLY_API_KEY');
async function generateWithLoudly({ genre, mood, tempo, duration }) {
  const res = await fetch('https://api.loudly.com/v1/generate', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${LOUDLY_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ genre, mood, bpm: tempo || 120, length: duration || 30 }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || JSON.stringify(data));
  return {
    audio_url: data.audio_url || data.url,
    bpm: data.bpm, key: data.key,
    provider: 'loudly', credits_used: 1,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { provider = 'sonic', duration = 60, mood = 'Energetic', genre = 'Hip-Hop',
            tempo, sound_prompt, lyrics, model, nuro_version, tempolor_mode } = await req.json();

    const job = await base44.entities.GenerationJob.create({
      user_id: user.id, user_email: user.email,
      job_type: 'music', provider,
      status: 'processing',
      input_data: { duration, mood, genre, tempo, sound_prompt },
      started_at: new Date().toISOString(),
    });

    let providerResult;
    try {
      if (provider === 'loudly' && LOUDLY_API_KEY)
        providerResult = await generateWithLoudly({ genre, mood, tempo, duration });
      else if (provider === 'nuro')
        providerResult = await generateWithNuro({ genre, mood, duration, nuro_version, lyrics });
      else if (provider === 'producer')
        providerResult = await generateWithProducer({ genre, mood, sound_prompt, lyrics });
      else if (provider === 'tempcolor')
        providerResult = await generateWithTempolor({ genre, mood, sound_prompt, lyrics, model, tempolor_mode });
      else // default: sonic
        providerResult = await generateWithSonic({ genre, mood, duration, sound_prompt, tempo, model });
    } catch (providerErr) {
      // Try sonic as fallback
      if (provider !== 'sonic' && SONIC_API_KEY) {
        try { providerResult = await generateWithSonic({ genre, mood, duration, sound_prompt, tempo }); }
        catch {}
      }
      if (!providerResult) {
        await base44.entities.GenerationJob.update(job.id, { status: 'failed', error_message: providerErr.message });
        return Response.json({ error: providerErr.message }, { status: 502 });
      }
    }

    // Synchronous result (e.g., Loudly)
    if (providerResult.audio_url) {
      await base44.entities.GenerationJob.update(job.id, {
        status: 'completed',
        output_url: providerResult.audio_url,
        output_metadata: { bpm: providerResult.bpm, key: providerResult.key, duration },
        credits_used: providerResult.credits_used || 1,
        completed_at: new Date().toISOString(),
      });
      return Response.json({
        job_id: job.id, status: 'completed',
        audio_url: providerResult.audio_url,
        bpm: providerResult.bpm, key: providerResult.key,
      });
    }

    // Async: store provider task_id in job record for polling
    await base44.entities.GenerationJob.update(job.id, {
      status: 'processing',
      provider_job_id: providerResult.task_id,
    });

    return Response.json({ job_id: job.id, status: 'processing' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});