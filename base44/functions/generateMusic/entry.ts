import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Both aimusicapi.ai providers (Sonic, Producer) share one API key.
// We only require SONIC_API_KEY to be set — it's used as the bearer token for both.
// Note: Nuro has been deprecated by aimusicapi.ai (returns HTTP 410 Gone).
const AIMUSICAPI_KEY   = Deno.env.get('SONIC_API_KEY');
const SONIC_API_KEY    = AIMUSICAPI_KEY;
const PRODUCER_API_KEY = AIMUSICAPI_KEY;
const TEMPCOLOR_API_KEY = Deno.env.get('TEMPCOLOR_API_KEY');
const WEBHOOK_SECRET = Deno.env.get('AIMUSICAPI_WEBHOOK_SECRET') || '';

const AI_BASE = 'https://api.aimusicapi.ai/api/v1';

// Public URL of our webhook receiver — derived from the app's deployed function path.
// The aimusicapi platform POSTs here when Sonic/Nuro/Producer tasks settle.
// Falls back gracefully (no webhook attached) if not configured.
function getWebhookConfig() {
  const url = Deno.env.get('AIMUSICAPI_WEBHOOK_URL'); // set this to https://<app>/functions/aimusicapiWebhook
  if (!url || !WEBHOOK_SECRET) return null;
  // Spec: webhook_url must be HTTPS, ≤ 1024 chars
  if (!url.startsWith('https://') || url.length > 1024) {
    console.warn('AIMUSICAPI_WEBHOOK_URL invalid (must be HTTPS, ≤1024 chars) — webhook disabled');
    return null;
  }
  return { webhook_url: url, webhook_secret: WEBHOOK_SECRET };
}

// ── Sonic ─────────────────────────────────────────────────────────────────────
// Docs: POST /api/v1/sonic/create — https://docs.aimusicapi.ai/sonic-api-instructions
// Response: { code: 200, task_id: "uuid", message: "success" }
// Poll: GET /api/v1/sonic/task/{task_id}
//
// Mode selection (per spec):
//   - With lyrics  → custom_mode:true, prompt=lyrics (max 3000/5000 chars by model)
//   - Auto lyrics  → custom_mode:true + auto_lyrics:true, prompt=seed (same char budget)
//   - Description  → custom_mode:false, gpt_description_prompt (max 400 chars)
//
// Char limits (spec):
//   prompt:                v3-5/v4 = 3000   |  v4-5+/v5/v5-5 = 5000
//   tags:                  v3-5/v4 = 200    |  v4-5+/v5/v5-5 = 1000
//   gpt_description_prompt: 400 (all models)
//   title:                 80 (all models)
//
// Model suitability: sonic-v3-5 and sonic-v4 have no vocal support. Force v4-5 minimum
// for vocal/auto-lyrics generation.
const SONIC_LIMITS = {
  'sonic-v3-5':     { prompt: 3000, tags: 200 },
  'sonic-v4':       { prompt: 3000, tags: 200 },
  'sonic-v4-5':     { prompt: 5000, tags: 1000 },
  'sonic-v4-5-plus':{ prompt: 5000, tags: 1000 },
  'sonic-v5':       { prompt: 5000, tags: 1000 },
  'sonic-v5-5':     { prompt: 5000, tags: 1000 },
};

async function generateWithSonic({ genre, mood, duration, sound_prompt, tempo, model, lyrics, sonic_persona_id }) {
  // Ensure a vocal-capable model is used
  const LEGACY_MODELS = ['sonic-v3-5', 'sonic-v4'];
  const safeModel = (!model || LEGACY_MODELS.includes(model)) ? 'sonic-v4-5' : model;
  const limits = SONIC_LIMITS[safeModel] || SONIC_LIMITS['sonic-v4-5'];

  // Per-spec field truncation
  const tags = [genre, mood].filter(Boolean).join(', ').slice(0, limits.tags);
  const title = `${mood} ${genre} Track`.slice(0, 80);

  let body;
  if (lyrics && lyrics.trim().length > 0) {
    // Custom mode: user-provided lyrics with section tags
    body = {
      task_type: 'create_music',
      custom_mode: true,
      mv: safeModel,
      title,
      tags,
      prompt: lyrics.slice(0, limits.prompt),
    };
  } else if (sound_prompt) {
    // Auto-lyrics mode: Sonic generates lyrics from the prompt
    // prompt uses the same char budget as custom mode (NOT the 400-char description limit)
    body = {
      task_type: 'create_music',
      custom_mode: true,
      auto_lyrics: true,
      mv: safeModel,
      title,
      tags,
      prompt: sound_prompt.slice(0, limits.prompt),
    };
  } else {
    // AI description mode: gpt_description_prompt is capped at 400 by spec
    const desc = `A ${mood.toLowerCase()} ${genre} track${tempo ? ` at ${tempo} BPM` : ''}`.slice(0, 400);
    body = {
      task_type: 'create_music',
      custom_mode: false,
      mv: safeModel,
      gpt_description_prompt: desc,
    };
  }

  // Voice persona — sing with a cloned Sonic voice (persona_music task type)
  if (sonic_persona_id) {
    body.task_type = 'persona_music';
    body.persona_id = sonic_persona_id;
  }

  // Attach webhook callback (if configured) — provider will POST results to our handler
  // when the task settles, eliminating the need for polling.
  const wh = getWebhookConfig();
  if (wh) Object.assign(body, wh);

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
  if (!res.ok) {
    // Surface aimusicapi error structure { type, error } per spec
    const err = new Error(data.error || data.message || `Sonic HTTP ${res.status}`);
    err.providerStatus = res.status;
    err.providerType = data.type || null;
    throw err;
  }
  const taskId = data.task_id;
  if (!taskId) throw new Error('No task_id from Sonic: ' + JSON.stringify(data));
  return { task_id: taskId, provider: 'sonic' };
}

// ── Producer ─────────────────────────────────────────────────────────────────
// Docs: POST /api/v1/producer/create — https://docs.aimusicapi.ai/producer-instructions
// Required: task_type: "create_music", plus sound and/or lyrics
// Models (mv): FUZZ-3-Demo | FUZZ-2.0 (default) | FUZZ-2.0 Pro | FUZZ-2.0 Raw | FUZZ-1.1 Pro | FUZZ-1.1 | FUZZ-1.0 Pro | FUZZ-1.0 | FUZZ-0.8
// Poll: GET /api/v1/producer/task/{task_id} → { status: "PENDING"|"RUNNING"|"SUCCESS"|"FAILED", data: [{audio_url,...}] }
// Retired task_types (HTTP 410): cover_music, extend_music, replace_music, swap_*, music_variation
const PRODUCER_VALID_MV = ['FUZZ-3-Demo','FUZZ-2.0','FUZZ-2.0 Pro','FUZZ-2.0 Raw','FUZZ-1.1 Pro','FUZZ-1.1','FUZZ-1.0 Pro','FUZZ-1.0','FUZZ-0.8'];

async function generateWithProducer({ genre, mood, sound_prompt, lyrics, model }) {
  const mv = (model && PRODUCER_VALID_MV.includes(model)) ? model : 'FUZZ-2.0';
  const body = {
    task_type: 'create_music',
    sound: (sound_prompt || `${mood} ${genre} music`).slice(0, 2000),
    mv,
    title: `${mood} ${genre}`.slice(0, 80),
    ...(lyrics && { lyrics: String(lyrics).slice(0, 5000), make_instrumental: false }),
    ...(!lyrics && { make_instrumental: true }),
  };
  const wh = getWebhookConfig();
  if (wh) Object.assign(body, wh);

  // 25s timeout matching Sonic — Producer occasionally hangs which causes gateway 502s
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  let res, data;
  try {
    res = await fetch(`${AI_BASE}/producer/create`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${PRODUCER_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    data = await res.json();
  } catch (fetchErr) {
    if (fetchErr.name === 'AbortError') {
      const err = new Error('Producer API timed out after 25s. Please try again or use Sonic.');
      err.providerStatus = 504;
      err.providerType = 'timeout';
      throw err;
    }
    throw fetchErr;
  } finally {
    clearTimeout(timeout);
  }
  console.log('Producer create response:', JSON.stringify(data));
  if (!res.ok) {
    // Surface aimusicapi error structure { type, error } per spec
    // Special: HTTP 410 = endpoint_retired, 402 = insufficient_credits, 502 = upstream_error
    const err = new Error(data.error || data.message || `Producer HTTP ${res.status}`);
    err.providerStatus = res.status;
    err.providerType = data.type || null;
    throw err;
  }
  // Docs: response is { message: "success", task_id: "uuid" }
  const taskId = data.task_id;
  if (!taskId) throw new Error('No task_id from Producer: ' + JSON.stringify(data));
  return { task_id: taskId, provider: 'producer' };
}

// ── Tempolor ──────────────────────────────────────────────────────────────────
// Auth: Authorization header = raw API key (e.g. "Tempo-xxx-3w"), NOT Bearer
// Docs audit (platform.tempolor.com/docs, 2026-07): single documented endpoint
//   POST /open-apis/v1/song/generate { prompt, model, lyrics?, instrumental?, action?, upload_audio_url?, callback_url }
//   Instrumental generation now uses instrumental:true on this endpoint (the old
//   /instrumental/generate route is no longer documented).
// Model catalog (docs/6665893m0 — Model and Pricing):
//   Song:  TemPolor v4.6 (flagship — musicality/quality/prompt-following, 5min, 30+ languages, streaming)
//          TemPolor v3.5 (natural lifelike vocals, 4.5min, zh/yue/en/ja)
//          Lyria 3 Pro   (by Google — polished vocals, 3min, multilingual)
//          Mureka V9     (richest arrangements, 5.5min, 10+ languages)
//          MiniMax 2.6   (premium vocals, longest tracks — 6min)
//   Instrumental: TemPolor i3.5 (flagship, 4.5min, precise duration control)
//          TemPolor i3   (fastest — <3s generation, 2min, cheapest)
//          Lyria 3 Pro / Mureka V9 / MiniMax 2.6 (as above, instrumental mode)
//   Cover (action=upload_cover): TemPolor v4.6 (keeps vocal melody, reshapes style)
//          Mureka V9 (full remix — mp3/m4a source, no instrumentals)
const TEMPOLOR_BASE = 'https://api.tempolor.com/open-apis/v1';
const TEMPOLOR_SONG_MODELS = ['TemPolor v4.6', 'TemPolor v3.5', 'Lyria 3 Pro', 'Mureka V9', 'MiniMax 2.6'];
const TEMPOLOR_INSTRUMENTAL_MODELS = ['TemPolor i3.5', 'TemPolor i3', 'Lyria 3 Pro', 'Mureka V9', 'MiniMax 2.6'];
const TEMPOLOR_COVER_MODELS = ['TemPolor v4.6', 'Mureka V9'];
// Legacy model names → current equivalents
const TEMPOLOR_LEGACY_MAP = { 'TemPolor v3': 'TemPolor v3.5' };

async function generateWithTempolor({ genre, mood, sound_prompt, lyrics, model, tempolor_mode, voice_id, cover_audio_url }) {
  const isInstrumental = tempolor_mode === 'instrumental' || (!lyrics && !voice_id && !cover_audio_url);

  // Resolve + validate the model against the documented catalog per mode
  const requested = TEMPOLOR_LEGACY_MAP[model] || model;
  let resolvedModel;
  if (cover_audio_url) resolvedModel = TEMPOLOR_COVER_MODELS.includes(requested) ? requested : 'TemPolor v4.6';
  else if (isInstrumental) resolvedModel = TEMPOLOR_INSTRUMENTAL_MODELS.includes(requested) ? requested : 'TemPolor i3.5';
  else resolvedModel = TEMPOLOR_SONG_MODELS.includes(requested) ? requested : 'TemPolor v4.6';

  const endpoint = `${TEMPOLOR_BASE}/song/generate`;

  // Tempolor hard limit: lyrics must be <= 3000 chars
  const safeLyrics = lyrics ? String(lyrics).slice(0, 3000) : null;

  // Real callback URL — Tempolor pushes 3 events (audio_complete, wav_complete, lrcsections_complete)
  // to /functions/tempolorWebhook. Falls back to webhook.site placeholder if not configured (dev mode).
  const callbackUrl = Deno.env.get('TEMPOLOR_WEBHOOK_URL') || 'https://webhook.site/tempolor-callback';

  const body = {
    prompt: (sound_prompt || `${mood} ${genre}${isInstrumental ? ' instrumental' : ''} music`).slice(0, 1000),
    model: resolvedModel,
    callback_url: callbackUrl,
    ...(isInstrumental
      ? { instrumental: true }
      : {
          lyrics: safeLyrics,
          // Optional: official singer voice (see Tempolor "Voice ID option table" in docs)
          ...(voice_id && { voice_id }),
          // Optional: cover mode — generates a stylistic cover of a reference track
          ...(cover_audio_url && { action: 'upload_cover', upload_audio_url: cover_audio_url }),
        }),
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
  return { task_id: itemId, provider: 'tempcolor', tempolor_mode: isInstrumental ? 'instrumental' : 'song', model: resolvedModel };
}

// ── Credit cost table (per provider) ─────────────────────────────────────────
const CREDIT_COSTS = {
  sonic: 10,
  producer: 10,
  tempcolor: 10,
};

async function checkCreditBalance(base44, user, requiredCredits) {
  const credits = await base44.asServiceRole.entities.UserCredit.filter({ user_id: user.id });
  const record = credits[0];
  const balance = record?.balance ?? 0;
  return { ok: balance >= requiredCredits, balance, record };
}

async function deductCreditsServerSide(base44, user, amount, { provider, job_id, description }) {
  const credits = await base44.asServiceRole.entities.UserCredit.filter({ user_id: user.id });
  let record = credits[0];
  if (!record) {
    record = await base44.asServiceRole.entities.UserCredit.create({
      user_id: user.id, user_email: user.email,
      balance: 0, lifetime_earned: 0, lifetime_spent: 0,
    });
  }
  const newBalance = (record.balance || 0) - amount;
  if (newBalance < 0) return { ok: false, balance: record.balance };
  await base44.asServiceRole.entities.UserCredit.update(record.id, {
    balance: newBalance,
    lifetime_spent: (record.lifetime_spent || 0) + amount,
    monthly_used: (record.monthly_used || 0) + amount,
  });
  await base44.asServiceRole.entities.CreditLog.create({
    user_id: user.id, user_email: user.email,
    transaction_type: 'generation',
    amount: -amount,
    balance_before: record.balance,
    balance_after: newBalance,
    related_job_id: job_id, provider, description,
  }).catch(() => {});
  return { ok: true, balance: newBalance };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let { provider = 'sonic', duration = 60, mood = 'Energetic', genre = 'Hip-Hop',
          tempo, sound_prompt, lyrics, model, tempolor_mode, routing_reason,
          voice_id, cover_audio_url, voice_persona_id } = await req.json();

    // Resolve a cloned Sonic voice persona (VoicePersona with provider='sonic')
    let sonicPersonaId = null;
    if (voice_persona_id && provider === 'sonic') {
      try {
        const personas = await base44.entities.VoicePersona.filter({ id: voice_persona_id });
        const p = personas[0];
        if (p && p.provider === 'sonic' && p.provider_voice_id) {
          sonicPersonaId = p.provider_voice_id;
          // Track usage (non-blocking)
          base44.entities.VoicePersona.update(p.id, { usage_count: (p.usage_count || 0) + 1 }).catch(() => {});
        }
      } catch (e) { console.warn('VoicePersona lookup failed:', e.message); }
    }

    // Nuro deprecated — auto-redirect to Sonic (vocal) or Producer (instrumental)
    if (provider === 'nuro') {
      provider = (lyrics && lyrics.trim().length > 0) ? 'sonic' : 'producer';
      routing_reason = `${routing_reason || 'auto'}_nuro_deprecated`;
    }

    // ── Pre-check credit balance (server-side gate) ──────────────────────────
    const cost = CREDIT_COSTS[provider] || 10;
    const { ok: hasCredits, balance } = await checkCreditBalance(base44, user, cost);
    if (!hasCredits) {
      return Response.json({
        error: 'Insufficient credits',
        required: cost, balance,
        message: `This generation costs ${cost} credits. You have ${balance}.`,
      }, { status: 402 });
    }

    // Call provider FIRST — before any DB writes — so gateway timeout isn't wasted on DB ops
    let providerResult;
    try {
      if (provider === 'producer')
        providerResult = await generateWithProducer({ genre, mood, sound_prompt, lyrics, model });
      else if (provider === 'tempcolor')
        providerResult = await generateWithTempolor({ genre, mood, sound_prompt, lyrics, model, tempolor_mode, voice_id, cover_audio_url });
      else // default: sonic
        providerResult = await generateWithSonic({ genre, mood, duration, sound_prompt, tempo: tempo || undefined, model, lyrics, sonic_persona_id: sonicPersonaId });
    } catch (providerErr) {
      // Map aimusicapi HTTP codes to actionable client responses per spec:
      // 400 validation_error · 401 unauthorized · 402/403 insufficient_credits/forbidden ·
      // 410 endpoint_retired · 429 rate_limited · 502 upstream_error · 500 internal_error · 504 timeout
      const pStatus = providerErr.providerStatus;
      const pType = providerErr.providerType;
      const clientStatus =
        pStatus === 400 ? 400 :
        pStatus === 401 ? 401 :
        pStatus === 402 ? 402 :
        pStatus === 403 ? 403 :
        pStatus === 410 ? 410 :
        pStatus === 429 ? 429 :
        pStatus === 504 ? 504 :
        502;
      return Response.json({
        error: providerErr.message,
        provider_type: pType,
        provider_status: pStatus,
      }, { status: clientStatus });
    }

    const generatedAt = new Date().toISOString();
    // Determine exact model version used per provider
    const modelVersionMap = {
      sonic: (() => { const LEGACY = ['sonic-v3-5', 'sonic-v4']; return (!model || LEGACY.includes(model)) ? 'sonic-v4-5' : model; })(),
      producer: 'FUZZ-2.0',
      tempcolor: providerResult.model || model || (tempolor_mode === 'instrumental' ? 'TemPolor i3.5' : 'TemPolor v4.6'),
    };
    const modelVersion = modelVersionMap[provider] || provider;

    // Simple content fingerprint for immutability/provenance
    const fingerprintData = `${user.id}|${provider}|${modelVersion}|${mood}|${genre}|${sound_prompt || ''}|${generatedAt}`;
    const encoder = new TextEncoder();
    const hashBuf = await crypto.subtle.digest('SHA-256', encoder.encode(fingerprintData));
    const contentHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    const logMetadata = {
      // RIAA/IFPI GenAI label — entirely prompt-generated sound recording
      ai_label: 'ai_generated',
      model_version: modelVersion,
      input_parameters: { duration, mood, genre, tempo, sound_prompt: (sound_prompt || '').slice(0, 200), has_lyrics: !!(lyrics && lyrics.trim()) },
      routing_reason: routing_reason || 'direct',
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
        ai_label: 'ai_generated',
        input_data: { duration, mood, genre, tempo, sound_prompt, credit_cost: cost },
        output_url: providerResult.audio_url,
        output_metadata: { bpm: providerResult.bpm, key: providerResult.key, duration },
        credits_used: cost,
        started_at: generatedAt,
        completed_at: generatedAt,
      }).catch(() => ({ id: null }));

      // Deduct credits now (sync success)
      const ded = await deductCreditsServerSide(base44, user, cost, {
        provider, job_id: jobRecord?.id, description: `${provider} music generation`,
      });

      base44.asServiceRole.entities.APIUsageLog.create({
        user_id: user.id, user_email: user.email, user_name: user.full_name,
        provider, task: 'generate_music',
        credits_used: cost,
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
        credits_used: cost,
        credits_remaining: ded.balance,
      });
    }

    // Async (Sonic, Nuro, Producer, Tempolor): create job record with provider task_id
    // Stamp credit_cost on input_data so pollGenerationJob can deduct on completion.
    // CRITICAL: persist lyrics, title, model + sound_prompt so they survive async recovery
    // and can be re-attached to ID3 tags + UserAsset metadata on completion.
    const job = await base44.entities.GenerationJob.create({
      user_id: user.id, user_email: user.email,
      job_type: 'music', provider,
      status: 'processing',
      ai_label: 'ai_generated',
      input_data: {
        duration, mood, genre, tempo, sound_prompt,
        lyrics: lyrics || '',
        model: modelVersion,
        credit_cost: cost,
        tempolor_mode: tempolor_mode || null,
      },
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