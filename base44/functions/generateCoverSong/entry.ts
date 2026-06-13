// Sonic upload-cover endpoint — generates a cover version of a user-supplied
// audio file with full creative control over style, lyrics, vocal gender, etc.
//
// Docs: https://docs.aimusicapi.ai/api-32136901
// Endpoint: POST /api/v1/sonic/upload-cover
// Polling:  GET  /api/v1/sonic/task/{task_id}   (handled by pollGenerationJob)
//
// Credit cost (per Sonic spec): 10
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SONIC_API_KEY = Deno.env.get('SONIC_API_KEY');
const WEBHOOK_SECRET = Deno.env.get('AIMUSICAPI_WEBHOOK_SECRET') || '';
const AI_BASE = 'https://api.aimusicapi.ai/api/v1';
const COVER_COST = 10;

// Sonic char limits per model — same as generateMusic
const SONIC_LIMITS = {
  'sonic-v3-5':      { prompt: 3000, tags: 200 },
  'sonic-v4':        { prompt: 3000, tags: 200 },
  'sonic-v4-5':      { prompt: 5000, tags: 1000 },
  'sonic-v4-5-plus': { prompt: 5000, tags: 1000 },
  'sonic-v5':        { prompt: 5000, tags: 1000 },
  'sonic-v5-5':      { prompt: 5000, tags: 1000 },
};
// vocal_gender is only honored on v4-5+
const VOCAL_GENDER_MODELS = new Set(['sonic-v4-5', 'sonic-v4-5-plus', 'sonic-v5', 'sonic-v5-5']);

function getWebhookConfig() {
  const url = Deno.env.get('AIMUSICAPI_WEBHOOK_URL');
  if (!url || !WEBHOOK_SECRET) return null;
  if (!url.startsWith('https://') || url.length > 1024) return null;
  return { webhook_url: url, webhook_secret: WEBHOOK_SECRET };
}

async function checkCreditBalance(base44, user, amount) {
  const credits = await base44.asServiceRole.entities.UserCredit.filter({ user_id: user.id });
  const record = credits[0];
  return { ok: (record?.balance ?? 0) >= amount, balance: record?.balance ?? 0 };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
      url,                    // required — source audio URL (≤ 8 min)
      mv = 'sonic-v4-5',      // model version
      custom_mode = true,     // true = use `prompt` (lyrics) / false = use `gpt_description_prompt`
      prompt,                 // lyrics (custom_mode=true)
      gpt_description_prompt, // style description (custom_mode=false)
      title,
      tags,                   // comma-separated style tags
      negative_tags,
      make_instrumental = false,
      style_weight,           // 0..1
      weirdness_constraint,   // 0..1
      audio_weight,           // 0..1
      vocal_gender,           // 'f' | 'm' (only on v4-5+)
      genre,                  // UI-side aggregation → folded into tags
      mood,                   // UI-side aggregation → folded into tags
    } = body;

    // ── Validation ───────────────────────────────────────────────────────────
    if (!url) return Response.json({ error: 'Source audio URL required' }, { status: 400 });
    if (!SONIC_LIMITS[mv]) return Response.json({ error: `Invalid model: ${mv}` }, { status: 400 });
    if (custom_mode && (!prompt || !prompt.trim())) {
      return Response.json({ error: 'Custom mode requires lyrics in `prompt`' }, { status: 400 });
    }
    if (!custom_mode && (!gpt_description_prompt || !gpt_description_prompt.trim())) {
      return Response.json({ error: 'AI mode requires `gpt_description_prompt`' }, { status: 400 });
    }

    // ── Credit gate ──────────────────────────────────────────────────────────
    const { ok: hasCredits, balance } = await checkCreditBalance(base44, user, COVER_COST);
    if (!hasCredits) {
      return Response.json({
        error: 'Insufficient credits',
        required: COVER_COST, balance,
        message: `Cover generation costs ${COVER_COST} credits. You have ${balance}.`,
      }, { status: 402 });
    }

    // ── Build request body ───────────────────────────────────────────────────
    const limits = SONIC_LIMITS[mv];
    // Fold UI-side genre/mood into tags if user supplied them
    const tagParts = [tags, genre, mood].filter(Boolean).map(s => String(s).trim()).filter(Boolean);
    const mergedTags = tagParts.join(', ').slice(0, limits.tags);

    const apiBody = {
      url,
      mv,
      custom_mode: !!custom_mode,
    };
    if (custom_mode) {
      apiBody.prompt = String(prompt).slice(0, limits.prompt);
    } else {
      apiBody.gpt_description_prompt = String(gpt_description_prompt).slice(0, 400);
    }
    if (title) apiBody.title = String(title).slice(0, 80);
    if (mergedTags) apiBody.tags = mergedTags;
    if (negative_tags) apiBody.negative_tags = String(negative_tags).slice(0, limits.tags);
    if (make_instrumental) apiBody.make_instrumental = true;
    if (typeof style_weight === 'number')          apiBody.style_weight = Math.max(0, Math.min(1, style_weight));
    if (typeof weirdness_constraint === 'number')  apiBody.weirdness_constraint = Math.max(0, Math.min(1, weirdness_constraint));
    if (typeof audio_weight === 'number')          apiBody.audio_weight = Math.max(0, Math.min(1, audio_weight));
    if (vocal_gender && VOCAL_GENDER_MODELS.has(mv) && (vocal_gender === 'f' || vocal_gender === 'm')) {
      apiBody.vocal_gender = vocal_gender;
    }

    // Webhook (optional)
    const wh = getWebhookConfig();
    if (wh) Object.assign(apiBody, wh);

    // ── Call provider ────────────────────────────────────────────────────────
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    let res, data;
    try {
      res = await fetch(`${AI_BASE}/sonic/upload-cover`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${SONIC_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(apiBody),
        signal: controller.signal,
      });
      data = await res.json();
    } finally {
      clearTimeout(timeout);
    }
    console.log('Sonic upload-cover response:', JSON.stringify(data));

    if (!res.ok) {
      const status = res.status === 402 ? 402 : res.status === 429 ? 429 : 502;
      return Response.json({
        error: data?.error || data?.message || `Sonic HTTP ${res.status}`,
        provider_type: data?.type || null,
        provider_status: res.status,
      }, { status });
    }

    const taskId = data.task_id;
    if (!taskId) return Response.json({ error: 'No task_id from Sonic', detail: data }, { status: 502 });

    // ── Create GenerationJob (so pollGenerationJob can drive completion) ─────
    const generatedAt = new Date().toISOString();
    const job = await base44.entities.GenerationJob.create({
      user_id: user.id, user_email: user.email,
      job_type: 'music', provider: 'sonic',
      status: 'processing',
      input_data: {
        cover_of: url,
        mv,
        custom_mode: !!custom_mode,
        prompt: custom_mode ? String(prompt).slice(0, 500) : undefined,
        gpt_description_prompt: !custom_mode ? gpt_description_prompt : undefined,
        title,
        tags: mergedTags,
        negative_tags,
        make_instrumental: !!make_instrumental,
        style_weight,
        weirdness_constraint,
        audio_weight,
        vocal_gender: apiBody.vocal_gender || null,
        genre, mood,
        lyrics: custom_mode ? prompt : '',
        model: mv,
        credit_cost: COVER_COST,
        task_kind: 'cover_song',
        upload_clip_id: data?.steps?.upload?.clip_id || null,
      },
      provider_job_id: taskId,
      started_at: generatedAt,
    });

    // Pending API log
    base44.asServiceRole.entities.APIUsageLog.create({
      user_id: user.id, user_email: user.email, user_name: user.full_name,
      provider: 'sonic', task: 'generate_cover_song',
      credits_used: 0, status: 'pending',
      timestamp: generatedAt,
      job_id: job.id,
      metadata: {
        model_version: mv,
        base44_job_id: job.id,
        provider_job_id: taskId,
        task_kind: 'cover_song',
      },
    }).catch(() => {});

    return Response.json({ job_id: job.id, status: 'processing', task_id: taskId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});