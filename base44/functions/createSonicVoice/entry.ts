import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Sonic voice cloning — creates a reusable voice persona from an audio file with clear vocals.
// Docs: POST /api/v1/sonic/create-voice (4 credits) → task_id → poll GET /api/v1/sonic/task/{task_id}
// → { data: { persona_id, name } }. persona_id is then used with task_type: persona_music.
//
// Two modes:
//   { audio_url, name? }  → submits clone task, deducts 4 credits, returns { task_id }
//   { task_id }           → polls; returns { status: 'processing' } or { status: 'completed', persona_id, name }

const AI_BASE = 'https://api.aimusicapi.ai/api/v1';
const CREDITS_PER_VOICE = 4;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = Deno.env.get('SONIC_API_KEY');
    const { audio_url, task_id, name } = await req.json();

    // ── Poll mode ─────────────────────────────────────────────────────────────
    if (task_id) {
      const res = await fetch(`${AI_BASE}/sonic/task/${task_id}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      const data = await res.json();
      console.log('createSonicVoice poll:', JSON.stringify(data).slice(0, 500));
      if (!res.ok) return Response.json({ error: data.error || data.message || `HTTP ${res.status}` }, { status: 502 });

      // Completed voice tasks return { code: 200, data: { persona_id, name } }
      const inner = data.data || {};
      const personaId = inner.persona_id || data.persona_id;
      if (personaId) {
        return Response.json({ status: 'completed', persona_id: personaId, name: inner.name || name || '' });
      }
      // Failed tasks surface an error/status
      const st = (inner.status || data.status || '').toString().toLowerCase();
      if (st.includes('fail') || st.includes('error')) {
        return Response.json({ status: 'failed', error: inner.error || data.message || 'Voice cloning failed' });
      }
      return Response.json({ status: 'processing' });
    }

    // ── Submit mode ───────────────────────────────────────────────────────────
    if (!audio_url) return Response.json({ error: 'audio_url or task_id required' }, { status: 400 });

    const res = await fetch(`${AI_BASE}/sonic/create-voice`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio_url }),
    });
    const data = await res.json();
    console.log('createSonicVoice submit:', JSON.stringify(data).slice(0, 500));
    if (!res.ok || !data.task_id) {
      return Response.json({ error: data.error || data.message || 'Sonic create-voice failed' }, { status: res.status === 400 ? 400 : 502 });
    }

    // Deduct credits (non-blocking)
    try {
      await base44.functions.invoke('deductCredits', {
        amount: CREDITS_PER_VOICE,
        provider: 'sonic',
        description: `Voice clone${name ? ` — ${name}` : ''}`,
      });
    } catch { /* non-blocking */ }

    // Usage log
    base44.asServiceRole.entities.APIUsageLog.create({
      user_id: user.id, user_email: user.email, user_name: user.full_name,
      provider: 'sonic', task: 'create_voice',
      credits_used: CREDITS_PER_VOICE, status: 'pending',
      timestamp: new Date().toISOString(),
      metadata: { audio_url: audio_url.slice(0, 300), task_id: data.task_id },
    }).catch(() => {});

    return Response.json({ task_id: data.task_id, credits_used: CREDITS_PER_VOICE });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});