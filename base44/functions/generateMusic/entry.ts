import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Sonic (aimusicapi.ai) — bearer token for the Sonic endpoints.
// Note: Nuro and Producer have been retired — Nuro returns HTTP 410 Gone (docs
// confirmed 2026-09-03), and Producer is no longer used by BASE Station
// (Sonic + Tempolor + ElevenLabs cover all cases). Riffusion is also deprecated.
const SONIC_API_KEY    = Deno.env.get('SONIC_API_KEY');
const TEMPCOLOR_API_KEY = Deno.env.get('TEMPCOLOR_API_KEY');
const WEBHOOK_SECRET = Deno.env.get('AIMUSICAPI_WEBHOOK_SECRET') || '';

const AI_BASE = 'https://api.aimusicapi.ai/api/v1';

// Public URL of our webhook receiver — derived from the app's deployed function path.
// The aimusicapi platform POSTs here when Sonic tasks settle.
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
// Model suitability: sonic-v3-5 and sonic-v4 have no vocal-gender support. Force v4-5
// minimum for vocal/auto-lyrics generation.
//
// Audit 2026-09-03 (docs.aimusicapi.ai/llms.txt):
//   - `use_suno_cdn` is now a REQUIRED boolean on /sonic/create (400 if absent).
//     false → files served from aimusicapi's own CDN, which is what we persist from.
//   - `duration` (integer 10–360s) is supported on create/persona/extend/cover.
//   - `vocal_gender` ('f'|'m') on v4-5, v4-5-plus, v5, v5-5.
//   - `sonic-v4-5-all` is NOT in the create endpoint enum (sample/mashup only) —
//     mapped to sonic-v4-5 here so a stale picker value can't 400.
//   - Upstream cost: advanced models (v4.5+/v5/v5.5) and description mode = 14
//     provider credits; v3.5/v4 custom mode = 10. Our user charge stays flat.
const SONIC_LIMITS = {
  'sonic-v3-5':     { prompt: 3000, tags: 200 },
  'sonic-v4':       { prompt: 3000, tags: 200 },
  'sonic-v4-5':     { prompt: 5000, tags: 1000 },
  'sonic-v4-5-plus':{ prompt: 5000, tags: 1000 },
  'sonic-v5':       { prompt: 5000, tags: 1000 },
  'sonic-v5-5':     { prompt: 5000, tags: 1000 },
};
const VOCAL_GENDER_MODELS = new Set(['sonic-v4-5', 'sonic-v4-5-plus', 'sonic-v5', 'sonic-v5-5']);
const SONIC_DURATION_MIN = 10;
const SONIC_DURATION_MAX = 360;

function resolveSonicModel(model) {
  const LEGACY_MODELS = ['sonic-v3-5', 'sonic-v4'];
  if (!model || LEGACY_MODELS.includes(model)) return 'sonic-v5';
  if (model === 'sonic-v4-5-all') return 'sonic-v4-5';
  return SONIC_LIMITS[model] ? model : 'sonic-v5';
}

async function generateWithSonic({
  genre, mood, duration, sound_prompt, tempo, model, lyrics, sonic_persona_id, title: userTitle,
  instrumental, vocal_gender, negative_tags, style_weight, weirdness_constraint,
}) {
  const safeModel = resolveSonicModel(model);
  const limits = SONIC_LIMITS[safeModel];

  // Per-spec field truncation
  const tags = [genre, mood].filter(Boolean).join(', ').slice(0, limits.tags);
  const title = (userTitle || `${mood} ${genre} Track`).slice(0, 80);

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

  // Required by the current API contract — see audit note above.
  body.use_suno_cdn = false;

  // Target length. The engine lands close to, not exactly on, the request.
  if (duration) {
    body.duration = Math.min(Math.max(Math.round(Number(duration)), SONIC_DURATION_MIN), SONIC_DURATION_MAX);
  }
  if (instrumental) body.make_instrumental = true;
  if (vocal_gender && VOCAL_GENDER_MODELS.has(safeModel) && (vocal_gender === 'f' || vocal_gender === 'm')) {
    body.vocal_gender = vocal_gender;
  }
  if (negative_tags) body.negative_tags = String(negative_tags).slice(0, limits.tags);
  if (typeof style_weight === 'number')         body.style_weight = Math.max(0, Math.min(1, style_weight));
  if (typeof weirdness_constraint === 'number') body.weirdness_constraint = Math.max(0, Math.min(1, weirdness_constraint));

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

// ── Tempolor ──────────────────────────────────────────────────────────────────
// Auth: Authorization header = raw API key (e.g. "Tempo-xxx-3w"), NOT Bearer
// Docs audit (platform.tempolor.com/docs, 2026-07): single documented endpoint
//   POST /open-apis/v1/song/generate { prompt, model, lyrics?, instrumental?, action?, upload_audio_url?, callback_url }
//   Instrumental generation now uses instrumental:true on this endpoint (the old
//   /instrumental/generate route is no longer documented).
// Model catalog — re-audited against docs/6665893m0 (Model and Pricing), 2026-08-23.
//
// IMPORTANT: TemPolor no longer publishes a version number for its own house song
// model. The numbered entries (v4.6, v3.5) are gone and there is now a single
// rolling identifier, `tempolor-latest`, for both song generation and
// reference-based generation (Cover). We pass that identifier through verbatim —
// inventing "TemPolor v4.7" to look tidy would send a model name the API does not
// know. The instrumental line is still versioned (i4 is new, i3 remains), so those
// keep their numbers.
//
//   Song (4 credits — tempolor-latest):
//     tempolor-latest  flagship, 5min vocal, 30+ languages, streaming playback
//     Eleven Music V2  by ElevenLabs — 5min, 44.1kHz MP3/WAV (70 credits upstream)
//     Lyria 3 Pro      by Google — lifelike vocals, 3min, multilingual
//     Mureka V9.5      newest Mureka — layered arrangements, 5.5min, 10+ languages
//     Mureka V9        cheaper Mureka, same 5.5min ceiling
//     MiniMax 3.0      by MiniMax — longest tracks (6min)
//   Instrumental:
//     TemPolor i4      NEW flagship instrumental, 3min
//     TemPolor i3      fastest (<3s) + cheapest, 2min, prompt duration control
//     Eleven Music V2 / Lyria 3 Pro / Mureka V9 / MiniMax 3.0 (instrumental mode)
//   Reference-based / Cover (action=upload_cover):
//     tempolor-latest  keeps the original vocal melody, reshapes the style
//     Mureka V9        full remix — mp3/m4a source, no instrumental sources
const TEMPOLOR_BASE = 'https://api.tempolor.com/open-apis/v1';
const TEMPOLOR_SONG_MODELS = ['tempolor-latest', 'Eleven Music V2', 'Lyria 3 Pro', 'Mureka V9.5', 'Mureka V9', 'MiniMax 3.0'];
const TEMPOLOR_INSTRUMENTAL_MODELS = ['TemPolor i4', 'TemPolor i3', 'Eleven Music V2', 'Lyria 3 Pro', 'Mureka V9', 'MiniMax 3.0'];
const TEMPOLOR_COVER_MODELS = ['tempolor-latest', 'Mureka V9'];
// Retired model names → their current equivalents. Kept so saved presets, queued
// jobs and library metadata written before this update still resolve to a live
// model instead of silently falling back to the default.
const TEMPOLOR_LEGACY_MAP = {
  'TemPolor v3': 'tempolor-latest',
  'TemPolor v3.5': 'tempolor-latest',
  'TemPolor v4': 'tempolor-latest',
  'TemPolor v4.6': 'tempolor-latest',
  'TemPolor i3.5': 'TemPolor i4',
  'MiniMax 2.6': 'MiniMax 3.0',
};
const TEMPOLOR_DEFAULT_SONG = 'tempolor-latest';
const TEMPOLOR_DEFAULT_INSTRUMENTAL = 'TemPolor i4';

async function generateWithTempolor({ genre, mood, sound_prompt, lyrics, model, tempolor_mode, voice_id, cover_audio_url }) {
  const isInstrumental = tempolor_mode === 'instrumental' || (!lyrics && !voice_id && !cover_audio_url);

  // Resolve + validate the model against the documented catalog per mode
  const requested = TEMPOLOR_LEGACY_MAP[model] || model;
  let resolvedModel;
  if (cover_audio_url) resolvedModel = TEMPOLOR_COVER_MODELS.includes(requested) ? requested : TEMPOLOR_DEFAULT_SONG;
  else if (isInstrumental) resolvedModel = TEMPOLOR_INSTRUMENTAL_MODELS.includes(requested) ? requested : TEMPOLOR_DEFAULT_INSTRUMENTAL;
  else resolvedModel = TEMPOLOR_SONG_MODELS.includes(requested) ? requested : TEMPOLOR_DEFAULT_SONG;

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

// ── ElevenLabs (Eleven Music) ─────────────────────────────────────────────────
// Docs: POST https://api.elevenlabs.io/v1/music — SYNCHRONOUS: returns the MP3 bytes
// directly (no task polling). Models: music_v1 (default) | music_v2 (48kHz output).
// prompt ≤ 4100 chars; music_length_ms 3000–600000 (optional — model picks if omitted);
// force_instrumental guarantees no vocals; sign_with_c2pa embeds a C2PA provenance
// manifest in the MP3 (fits our Provenance Manifest system).
const ELEVENLABS_API = Deno.env.get('ELEVENLABS_API');
const ELEVEN_BASE = 'https://api.elevenlabs.io/v1';

// Eleven Music length policy.
// music_length_ms accepts 3s–600s. If we pass nothing the model picks, and it
// tends to pick a short clip — but the real bug was that this function used to
// default `duration` to 60, so EVERY Eleven track came back exactly 1:00 even
// when the caller never asked for a length. Length is now derived from the
// actual material: a lyric sheet's line count sets the song's shape, and a
// prompt-only track gets a full arrangement rather than a one-minute stub.
const ELEVEN_MIN_MS = 3000;
const ELEVEN_MAX_MS = 600000;

function elevenLengthMs({ duration, lyrics }) {
  // Explicit user choice always wins.
  if (duration) return Math.min(Math.max(Math.round(duration * 1000), ELEVEN_MIN_MS), ELEVEN_MAX_MS);

  const text = (lyrics || '').trim();
  if (text) {
    // Sung lines land around 4s each; sections need intro/turnaround/outro room.
    const lines = text.split('\n').filter(l => l.trim() && !/^\s*\[/.test(l)).length;
    const sections = (text.match(/\[/g) || []).length;
    const est = 20 + lines * 4 + sections * 6;
    return Math.min(Math.max(Math.round(est) * 1000, 90000), ELEVEN_MAX_MS);
  }

  // Instrumental / prompt-only: a full-length arrangement, not a loop.
  return 180000;
}

async function generateWithElevenLabs({ genre, mood, duration, sound_prompt, lyrics, model, tempolor_mode }, base44) {
  if (!ELEVENLABS_API) throw new Error('ELEVENLABS_API key not configured');
  const modelId = model === 'music_v2' ? 'music_v2' : 'music_v1';

  // Single natural-language prompt — style context + optional user lyrics inline
  let prompt = sound_prompt || `A ${mood} ${genre} track`;
  const style = [genre, mood].filter(Boolean).join(', ');
  if (style) prompt += `. Style: ${style}.`;
  const hasLyrics = !!(lyrics && lyrics.trim());
  if (hasLyrics) prompt += `\n\nUse these lyrics:\n${lyrics.trim()}`;
  prompt = prompt.slice(0, 4100);

  const lengthMs = elevenLengthMs({ duration, lyrics });
  const body = {
    prompt,
    model_id: modelId,
    force_instrumental: !hasLyrics && tempolor_mode === 'instrumental',
    sign_with_c2pa: true,
    music_length_ms: lengthMs,
  };
  console.log('ElevenLabs music_length_ms:', lengthMs, 'explicit duration:', duration ?? 'none');

  const controller = new AbortController();
  // Longer tracks take longer to render — the old 120s ceiling aborted full-length songs.
  const timeout = setTimeout(() => controller.abort(), 280000);
  let res;
  try {
    res = await fetch(`${ELEVEN_BASE}/music?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': ELEVENLABS_API, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (fetchErr) {
    if (fetchErr.name === 'AbortError') {
      const err = new Error('ElevenLabs music generation timed out. Try a shorter duration.');
      err.providerStatus = 504;
      err.providerType = 'timeout';
      throw err;
    }
    throw fetchErr;
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) {
    let detail = '';
    try {
      const j = await res.json();
      detail = j?.detail?.message || (typeof j?.detail === 'string' ? j.detail : JSON.stringify(j.detail || j));
    } catch { detail = ''; }
    const err = new Error(`ElevenLabs: ${detail || `HTTP ${res.status}`}`);
    err.providerStatus = res.status;
    throw err;
  }
  const songId = res.headers.get('song-id') || null;
  const bytes = await res.arrayBuffer();
  const file = new File([bytes], `eleven-music-${Date.now()}.mp3`, { type: 'audio/mpeg' });
  const { file_url } = await base44.integrations.Core.UploadFile({ file });
  console.log('ElevenLabs music generated:', file_url, 'song-id:', songId);
  return { audio_url: file_url, provider: 'elevenlabs', song_id: songId, model: modelId };
}

// ── Credit cost table (per provider) ─────────────────────────────────────────
const CREDIT_COSTS = {
  sonic: 10,
  tempcolor: 10,
  elevenlabs: 10,
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

    // NOTE: duration is intentionally NOT defaulted. A default here silently
    // capped every ElevenLabs track at 1:00; absent means "let the length follow
    // the material" (see elevenLengthMs).
    let { provider = 'sonic', duration, mood = 'Energetic', genre = 'Hip-Hop',
          tempo, sound_prompt, lyrics, model, tempolor_mode, routing_reason,
          voice_id, cover_audio_url, voice_persona_id, title,
          // Sonic style controls (all optional)
          vocal_gender, negative_tags, style_weight, weirdness_constraint, instrumental } = await req.json();
    // `tempolor_mode: 'instrumental'` is the long-standing UI signal for "no vocals";
    // honour it for Sonic too so the same toggle drives make_instrumental.
    const wantsInstrumental = !!instrumental || tempolor_mode === 'instrumental';

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

    // Nuro deprecated — auto-redirect to Sonic (vocal) or Tempolor (instrumental)
    if (provider === 'nuro') {
      provider = (lyrics && lyrics.trim().length > 0) ? 'sonic' : 'tempcolor';
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
      if (provider === 'elevenlabs')
        providerResult = await generateWithElevenLabs({ genre, mood, duration, sound_prompt, lyrics, model, tempolor_mode }, base44);
      else if (provider === 'tempcolor')
        providerResult = await generateWithTempolor({ genre, mood, sound_prompt, lyrics, model, tempolor_mode, voice_id, cover_audio_url });
      else // default: sonic
        providerResult = await generateWithSonic({
          genre, mood, duration, sound_prompt, tempo: tempo || undefined, model, lyrics,
          sonic_persona_id: sonicPersonaId, title,
          instrumental: wantsInstrumental, vocal_gender, negative_tags, style_weight, weirdness_constraint,
        });
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
      sonic: resolveSonicModel(model),
      tempcolor: providerResult.model || model || (tempolor_mode === 'instrumental' ? TEMPOLOR_DEFAULT_INSTRUMENTAL : TEMPOLOR_DEFAULT_SONG),
      elevenlabs: providerResult.model || model || 'music_v1',
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

    // Async (Sonic, Tempolor): create job record with provider task_id
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
        title: title || '',
        lyrics: lyrics || '',
        model: modelVersion,
        credit_cost: cost,
        tempolor_mode: tempolor_mode || null,
        ...(provider === 'sonic' && {
          make_instrumental: wantsInstrumental,
          vocal_gender: vocal_gender || null,
          negative_tags: negative_tags || null,
          style_weight: typeof style_weight === 'number' ? style_weight : null,
          weirdness_constraint: typeof weirdness_constraint === 'number' ? weirdness_constraint : null,
        }),
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