import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SONIC_API_KEY    = Deno.env.get('SONIC_API_KEY');
const NURO_API_KEY     = Deno.env.get('NURO_API_KEY');
const PRODUCER_API_KEY = Deno.env.get('PRODUCER_API_KEY');

const AI_BASE = 'https://api.aimusicapi.ai/api/v1';

// ── Sonic (description mode — no lyrics required) ────────────────────────────
async function generateWithSonic({ genre, mood, duration, sound_prompt, tempo }) {
  const tags = [genre, mood, tempo ? `${tempo}bpm` : null].filter(Boolean).join(', ');
  const res = await fetch(`${AI_BASE}/sonic/create`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SONIC_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      custom_mode: false,
      mv: 'sonic-v4-5',
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

// ── Nuro (instrument music — no lyrics) ─────────────────────────────────────
async function generateWithNuro({ genre, mood, duration }) {
  const res = await fetch(`${AI_BASE}/nuro/create`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${NURO_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'bgm', // bgm = instrument music
      genre: genre || 'Pop',
      mood: mood || 'Dynamic/Energetic',
      duration: Math.min(Math.max(duration || 60, 30), 240),
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || JSON.stringify(data));
  const taskId = data.task_id || data.id || (Array.isArray(data) && data[0]?.id);
  if (!taskId) throw new Error('No task_id from Nuro');
  return { task_id: taskId, provider: 'nuro' };
}

// ── Producer ─────────────────────────────────────────────────────────────────
async function generateWithProducer({ genre, mood, sound_prompt, lyrics }) {
  const res = await fetch(`${AI_BASE}/producer/create`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${PRODUCER_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gpt_description_prompt: sound_prompt || `${mood} ${genre} instrumental music`,
      lyrics: lyrics || '',
      style: `${genre}, ${mood}`,
      title: `${mood} ${genre}`,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || JSON.stringify(data));
  const taskId = data.task_id || data.id || (Array.isArray(data) && data[0]?.id);
  if (!taskId) throw new Error('No task_id from Producer');
  return { task_id: taskId, provider: 'producer' };
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
            tempo, sound_prompt, lyrics } = await req.json();

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
        providerResult = await generateWithNuro({ genre, mood, duration });
      else if (provider === 'producer')
        providerResult = await generateWithProducer({ genre, mood, sound_prompt, lyrics });
      else // default: sonic
        providerResult = await generateWithSonic({ genre, mood, duration, sound_prompt, tempo });
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