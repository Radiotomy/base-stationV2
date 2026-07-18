import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// ElevenLabs Text-to-Sound-Effects
// Docs: POST https://api.elevenlabs.io/v1/sound-generation — SYNCHRONOUS, returns MP3 bytes.
// Params: text (required), duration_seconds (0.5–30, omit = auto), loop (v2 only),
// prompt_influence (0–1, default 0.3), model_id: eleven_text_to_sound_v2.
const SFX_COST = 3;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const key = Deno.env.get('ELEVENLABS_API');
    if (!key) return Response.json({ error: 'ELEVENLABS_API not configured' }, { status: 500 });

    const { text, duration_seconds, loop = false, prompt_influence = 0.3 } = await req.json();
    if (!text || !String(text).trim()) return Response.json({ error: 'Missing text — describe the sound effect' }, { status: 400 });

    // ── Server-side credit gate ──────────────────────────────────────────────
    const credits = await base44.asServiceRole.entities.UserCredit.filter({ user_id: user.id });
    let record = credits[0];
    const balance = record?.balance ?? 0;
    if (balance < SFX_COST) {
      return Response.json({
        error: 'Insufficient credits',
        required: SFX_COST, balance,
        message: `Sound effect generation costs ${SFX_COST} credits. You have ${balance}.`,
      }, { status: 402 });
    }

    const body = {
      text: String(text).slice(0, 2000),
      model_id: 'eleven_text_to_sound_v2',
      loop: !!loop,
      prompt_influence: Math.max(0, Math.min(1, Number(prompt_influence) || 0.3)),
      ...(duration_seconds ? { duration_seconds: Math.max(0.5, Math.min(30, Number(duration_seconds))) } : {}),
    };

    const res = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let detail = '';
      try {
        const j = await res.json();
        detail = j?.detail?.message || (typeof j?.detail === 'string' ? j.detail : JSON.stringify(j.detail || j));
      } catch { detail = ''; }
      console.error('ElevenLabs SFX error:', res.status, detail);
      return Response.json({ error: `ElevenLabs SFX: ${detail || `HTTP ${res.status}`}` }, { status: 502 });
    }

    const bytes = await res.arrayBuffer();
    const file = new File([bytes], `sfx-${Date.now()}.mp3`, { type: 'audio/mpeg' });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    const now = new Date().toISOString();

    // Job record (completed — sync generation)
    const job = await base44.asServiceRole.entities.GenerationJob.create({
      user_id: user.id, user_email: user.email,
      job_type: 'sfx', provider: 'elevenlabs',
      status: 'completed',
      input_data: { text: body.text, duration_seconds: body.duration_seconds || null, loop: body.loop, prompt_influence: body.prompt_influence, credit_cost: SFX_COST },
      output_url: file_url,
      credits_used: SFX_COST,
      started_at: now, completed_at: now,
    }).catch(() => null);

    // Deduct credits
    if (!record) {
      record = await base44.asServiceRole.entities.UserCredit.create({
        user_id: user.id, user_email: user.email,
        balance: 0, lifetime_earned: 0, lifetime_spent: 0,
      });
    }
    const newBalance = (record.balance || 0) - SFX_COST;
    await base44.asServiceRole.entities.UserCredit.update(record.id, {
      balance: newBalance,
      lifetime_spent: (record.lifetime_spent || 0) + SFX_COST,
      monthly_used: (record.monthly_used || 0) + SFX_COST,
    });
    await base44.asServiceRole.entities.CreditLog.create({
      user_id: user.id, user_email: user.email,
      transaction_type: 'generation',
      amount: -SFX_COST,
      balance_before: record.balance, balance_after: newBalance,
      related_job_id: job?.id, provider: 'elevenlabs',
      description: 'ElevenLabs sound effect generation',
    }).catch(() => {});

    base44.asServiceRole.entities.APIUsageLog.create({
      user_id: user.id, user_email: user.email, user_name: user.full_name,
      provider: 'elevenlabs', task: 'generate_sfx',
      credits_used: SFX_COST, status: 'success',
      timestamp: now, job_id: job?.id || null,
      metadata: { model_version: 'eleven_text_to_sound_v2', text: body.text.slice(0, 200), duration_seconds: body.duration_seconds || null, loop: body.loop },
    }).catch(() => {});

    return Response.json({
      audio_url: file_url,
      model_version: 'eleven_text_to_sound_v2',
      credits_used: SFX_COST,
      credits_remaining: newBalance,
    });
  } catch (error) {
    console.error('generateSoundEffect error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});