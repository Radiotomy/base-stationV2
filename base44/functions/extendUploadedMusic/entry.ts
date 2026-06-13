// Sonic "Special Scenarios" — extend an uploaded audio file.
//
// Docs: https://docs.aimusicapi.ai/doc-2058746 (Method 1: Extend Uploaded Music)
//       https://docs.aimusicapi.ai/api-32136918 (upload endpoint)
//       https://docs.aimusicapi.ai/api-32136899 (create endpoint)
//
// Workflow:
//   1) POST /api/v1/sonic/upload  { url } → { clip_id }    (sync, ~20s)
//   2) POST /api/v1/sonic/create  { task_type: extend_upload_music,
//                                   continue_clip_id, continue_at, ... }
//                                 → { task_id }
//   3) Poll /api/v1/sonic/task/{task_id}  (handled by pollGenerationJob)
//
// Credits: 10 (Sonic generation)
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SONIC_API_KEY = Deno.env.get('SONIC_API_KEY');
const WEBHOOK_SECRET = Deno.env.get('AIMUSICAPI_WEBHOOK_SECRET') || '';
const AI_BASE = 'https://api.aimusicapi.ai/api/v1';
const EXTEND_COST = 10;

const SONIC_LIMITS = {
  'sonic-v3-5':      { prompt: 3000, tags: 200 },
  'sonic-v4':        { prompt: 3000, tags: 200 },
  'sonic-v4-5':      { prompt: 5000, tags: 1000 },
  'sonic-v4-5-plus': { prompt: 5000, tags: 1000 },
  'sonic-v5':        { prompt: 5000, tags: 1000 },
  'sonic-v5-5':      { prompt: 5000, tags: 1000 },
};
const VOCAL_GENDER_MODELS = new Set(['sonic-v4-5', 'sonic-v4-5-plus', 'sonic-v5', 'sonic-v5-5']);

function getWebhookConfig() {
  const url = Deno.env.get('AIMUSICAPI_WEBHOOK_URL');
  if (!url || !WEBHOOK_SECRET) return null;
  if (!url.startsWith('https://') || url.length > 1024) return null;
  return { webhook_url: url, webhook_secret: WEBHOOK_SECRET };
}

async function uploadToSonic(audioUrl) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 60000); // upload can take ~20s+
  try {
    const res = await fetch(`${AI_BASE}/sonic/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SONIC_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: audioUrl }),
      signal: controller.signal,
    });
    const data = await res.json();
    console.log('Sonic upload response:', JSON.stringify(data));
    if (!res.ok || !data.clip_id) {
      const err = new Error(data?.error || data?.message || `Upload failed (HTTP ${res.status})`);
      err.providerStatus = res.status;
      throw err;
    }
    return data.clip_id;
  } finally {
    clearTimeout(t);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
      url,                       // required — source audio URL (≤ 8 min)
      clip_id: existingClipId,   // optional — skip upload step if user already has a clip_id
      mv = 'sonic-v4-5',
      custom_mode = true,
      prompt,
      gpt_description_prompt,
      title,
      tags,
      negative_tags,
      genre,
      mood,
      continue_at = 0.1,         // seconds — where the extension begins
      make_instrumental = false,
      style_weight,
      weirdness_constraint,
      audio_weight,
      vocal_gender,
    } = body;

    // ── Validation ───────────────────────────────────────────────────────────
    if (!url && !existingClipId) {
      return Response.json({ error: 'Provide either `url` (to upload) or `clip_id`' }, { status: 400 });
    }
    if (!SONIC_LIMITS[mv]) return Response.json({ error: `Invalid model: ${mv}` }, { status: 400 });
    if (custom_mode && (!prompt || !prompt.trim())) {
      return Response.json({ error: 'Custom mode requires lyrics in `prompt`' }, { status: 400 });
    }
    if (!custom_mode && (!gpt_description_prompt || !gpt_description_prompt.trim())) {
      return Response.json({ error: 'AI mode requires `gpt_description_prompt`' }, { status: 400 });
    }

    // ── Credit gate ──────────────────────────────────────────────────────────
    const credits = await base44.asServiceRole.entities.UserCredit.filter({ user_id: user.id });
    const balance = credits[0]?.balance ?? 0;
    if (balance < EXTEND_COST) {
      return Response.json({
        error: 'Insufficient credits',
        required: EXTEND_COST, balance,
        message: `Extending a track costs ${EXTEND_COST} credits. You have ${balance}.`,
      }, { status: 402 });
    }

    // ── Step 1: Upload (if needed) ───────────────────────────────────────────
    let clipId = existingClipId;
    if (!clipId) {
      try {
        clipId = await uploadToSonic(url);
      } catch (e) {
        return Response.json({
          error: e.message || 'Upload to Sonic failed',
          provider_status: e.providerStatus || 502,
        }, { status: e.providerStatus === 402 ? 402 : 502 });
      }
    }

    // ── Step 2: Create extension task ────────────────────────────────────────
    const limits = SONIC_LIMITS[mv];
    const tagParts = [tags, genre, mood].filter(Boolean).map(s => String(s).trim()).filter(Boolean);
    const mergedTags = tagParts.join(', ').slice(0, limits.tags);

    const apiBody = {
      task_type: 'extend_upload_music',
      continue_clip_id: clipId,
      continue_at: Number(continue_at) || 0.1,
      custom_mode: !!custom_mode,
      mv,
    };
    if (custom_mode) apiBody.prompt = String(prompt).slice(0, limits.prompt);
    else             apiBody.gpt_description_prompt = String(gpt_description_prompt).slice(0, 400);
    if (title)        apiBody.title = String(title).slice(0, 80);
    if (mergedTags)   apiBody.tags = mergedTags;
    if (negative_tags) apiBody.negative_tags = String(negative_tags).slice(0, limits.tags);
    if (make_instrumental) apiBody.make_instrumental = true;
    if (typeof style_weight === 'number')         apiBody.style_weight = Math.max(0, Math.min(1, style_weight));
    if (typeof weirdness_constraint === 'number') apiBody.weirdness_constraint = Math.max(0, Math.min(1, weirdness_constraint));
    if (typeof audio_weight === 'number')         apiBody.audio_weight = Math.max(0, Math.min(1, audio_weight));
    if (vocal_gender && VOCAL_GENDER_MODELS.has(mv) && (vocal_gender === 'f' || vocal_gender === 'm')) {
      apiBody.vocal_gender = vocal_gender;
    }

    const wh = getWebhookConfig();
    if (wh) Object.assign(apiBody, wh);

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 30000);
    let res, data;
    try {
      res = await fetch(`${AI_BASE}/sonic/create`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${SONIC_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(apiBody),
        signal: controller.signal,
      });
      data = await res.json();
    } finally { clearTimeout(t); }

    console.log('Sonic extend_upload_music response:', JSON.stringify(data));
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

    // ── Create GenerationJob ─────────────────────────────────────────────────
    const generatedAt = new Date().toISOString();
    const job = await base44.entities.GenerationJob.create({
      user_id: user.id, user_email: user.email,
      job_type: 'music', provider: 'sonic',
      status: 'processing',
      input_data: {
        source_url: url || null,
        upload_clip_id: clipId,
        continue_at,
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
        credit_cost: EXTEND_COST,
        task_kind: 'extend_upload_music',
      },
      provider_job_id: taskId,
      started_at: generatedAt,
    });

    base44.asServiceRole.entities.APIUsageLog.create({
      user_id: user.id, user_email: user.email, user_name: user.full_name,
      provider: 'sonic', task: 'extend_uploaded_music',
      credits_used: 0, status: 'pending',
      timestamp: generatedAt, job_id: job.id,
      metadata: {
        model_version: mv,
        base44_job_id: job.id,
        provider_job_id: taskId,
        upload_clip_id: clipId,
        task_kind: 'extend_upload_music',
      },
    }).catch(() => {});

    return Response.json({
      job_id: job.id,
      status: 'processing',
      task_id: taskId,
      clip_id: clipId,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});