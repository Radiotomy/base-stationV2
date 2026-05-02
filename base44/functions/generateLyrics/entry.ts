import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SONIC_API_KEY    = Deno.env.get('SONIC_API_KEY');
const NURO_API_KEY     = Deno.env.get('NURO_API_KEY');

const AI_BASE = 'https://api.aimusicapi.ai/api/v1';

// ── AI Music API Lyrics (/sonic/lyrics) ─────────────────────────────────────
async function generateWithAIMusicAPI({ topic, mood, style, length }) {
  const key = SONIC_API_KEY || NURO_API_KEY;
  const lengthHint = { 'Short (8–16 bars)': 'short', 'Short (8-16 bars)': 'short',
    'Medium (32 bars)': 'medium', 'Long (64+ bars)': 'long', 'Full Song': 'full' }[length] || 'medium';

  const topicShort = topic.substring(0, 80);
  const res = await fetch(`${AI_BASE}/sonic/lyrics`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      description: `Write ${style} lyrics about "${topicShort}". Mood: ${mood}.`,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || JSON.stringify(data));

  // Returns array of results — pick the first
  const first = Array.isArray(data.results) ? data.results[0] : null;
  if (!first?.lyrics) throw new Error('No lyrics in response');
  return { lyrics: first.lyrics, title: first.title, provider: 'aimusicapi', credits_used: 1 };
}

// ── LLM Fallback ─────────────────────────────────────────────────────────────
async function generateWithLLM(base44, { topic, mood, style, length }) {
  const prompt = `You are an expert ${style} songwriter. Write original, creative song lyrics about: "${topic}".
Mood: ${mood}. Length: ${length}.
Use proper song structure with tags like [Verse], [Chorus], [Bridge], [Outro].
Make lyrics authentic, evocative, and fitting for ${style} music.
Output ONLY the lyrics — no explanations or commentary.`;

  const result = await base44.integrations.Core.InvokeLLM({ prompt });
  return { lyrics: result, provider: 'llm_fallback', credits_used: 1 };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { topic, mood = 'Happy', style = 'Hip-Hop', length = 'Medium (32 bars)' } = await req.json();
    if (!topic) return Response.json({ error: 'Missing topic' }, { status: 400 });

    const job = await base44.entities.GenerationJob.create({
      user_id: user.id, user_email: user.email,
      job_type: 'lyrics', provider: 'sonic',
      status: 'processing',
      input_data: { topic, mood, style, length },
      started_at: new Date().toISOString(),
    });

    let result;

    // Try AI Music API (sonic/lyrics endpoint) first
    if (SONIC_API_KEY || NURO_API_KEY) {
      try { result = await generateWithAIMusicAPI({ topic, mood, style, length }); }
      catch (e) { console.warn('AI Music API lyrics failed:', e.message); }
    }

    // LLM fallback
    if (!result?.lyrics) {
      result = await generateWithLLM(base44, { topic, mood, style, length });
    }

    if (!result?.lyrics) {
      await base44.entities.GenerationJob.update(job.id, { status: 'failed', error_message: 'All providers failed' });
      return Response.json({ error: 'Failed to generate lyrics' }, { status: 502 });
    }

    await base44.entities.GenerationJob.update(job.id, {
      status: 'completed',
      credits_used: result.credits_used || 1,
      completed_at: new Date().toISOString(),
    });

    await base44.asServiceRole.entities.APIUsageLog.create({
      user_id: user.id, user_email: user.email, user_name: user.full_name,
      provider: result.provider, task: 'generate_lyrics',
      credits_used: result.credits_used || 1,
      status: 'success', timestamp: new Date().toISOString(), job_id: job.id,
    }).catch(() => {});

    return Response.json({
      job_id: job.id, status: 'completed',
      lyrics: result.lyrics,
      title: result.title,
      provider: result.provider,
      credits_used: result.credits_used,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});