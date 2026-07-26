// Sonic Mashup — mix two existing tracks into a new song.
//
// Docs: https://docs.aimusicapi.ai/api-32136904 (sonic/mashup)
//       https://docs.aimusicapi.ai/api-32136918 (sonic/upload)
//
// Workflow:
//   1) Re-host each source to IPFS (so Sonic's HEAD-probe accepts it)
//   2) POST /api/v1/sonic/upload twice → { clip_id_a, clip_id_b }
//   3) POST /api/v1/sonic/mashup { mashup_clip_ids: [a, b], custom_mode, mv, ... }
//      → { task_id }
//   4) Poll get-music with task_id (handled by pollGenerationJob)
//
// Credits: 10 (Sonic generation, per docs)
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { waitUntil } from 'base44:runtime';
import { assertSafeUrl } from '../../shared/safeUrl.ts';

const SONIC_API_KEY = Deno.env.get('SONIC_API_KEY');
const WEBHOOK_SECRET = Deno.env.get('AIMUSICAPI_WEBHOOK_SECRET') || '';
const AI_BASE = 'https://api.aimusicapi.ai/api/v1';
const MASHUP_COST = 10;

const SONIC_LIMITS = {
  'sonic-v3-5':      { prompt: 3000, tags: 200, gpt: 200 },
  'sonic-v4':        { prompt: 3000, tags: 200, gpt: 200 },
  'sonic-v4-5':      { prompt: 3000, tags: 200, gpt: 200 },
  'sonic-v4-5-plus': { prompt: 3000, tags: 200, gpt: 200 },
  'sonic-v5':        { prompt: 3000, tags: 200, gpt: 200 },
  'sonic-v5-5':      { prompt: 3000, tags: 200, gpt: 200 },
};
const VOCAL_GENDER_MODELS = new Set(['sonic-v4-5', 'sonic-v4-5-plus', 'sonic-v5', 'sonic-v5-5']);

function getWebhookConfig() {
  const url = Deno.env.get('AIMUSICAPI_WEBHOOK_URL');
  if (!url || !WEBHOOK_SECRET) return null;
  if (!url.startsWith('https://') || url.length > 1024) return null;
  return { webhook_url: url, webhook_secret: WEBHOOK_SECRET };
}

// Pinata IPFS rehosting — same pattern as generateCoverSong / extendUploadedMusic.
// Sonic's /sonic/upload HEAD-probes the URL; Base44 file URLs 404 on HEAD, so
// non-public sources must be pinned to IPFS first.
const PINATA_JWT = Deno.env.get('PINATA_JWT');
const PINATA_BASE = 'https://api.pinata.cloud';
const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs';

async function pinFileFromUrl(fileUrl, name) {
  // SSRF guard — block loopback/private/IP-literal targets before fetching
  const fileRes = await fetch(assertSafeUrl(fileUrl));
  if (!fileRes.ok) throw new Error(`Failed to fetch source file (HTTP ${fileRes.status})`);
  const blob = await fileRes.blob();
  const form = new FormData();
  form.append('file', blob, name || 'source.mp3');
  form.append('pinataMetadata', JSON.stringify({ name: name || 'sonic-source' }));
  const res = await fetch(`${PINATA_BASE}/pinning/pinFileToIPFS`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${PINATA_JWT}` },
    body: form,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pinata upload failed (${res.status}): ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return `${PINATA_GATEWAY}/${data.IpfsHash}`;
}

function isAlreadyPublic(u) {
  try {
    const h = new URL(u).hostname;
    if (h === 'media.base44.com') return true;
    if (h.endsWith('pinata.cloud') || h.endsWith('ipfs.io') || h.endsWith('w3s.link')) return true;
    if (h.endsWith('cdn1.suno.ai') || h.endsWith('cdn.suno.ai')) return true;
    return !/(^|\.)base44\.(app|com)$/.test(h) && !h.includes('preview-sandbox');
  } catch { return false; }
}

async function ensurePublicUrl(sourceUrl) {
  if (isAlreadyPublic(sourceUrl)) return sourceUrl;
  if (!PINATA_JWT) throw new Error('PINATA_JWT not configured — cannot re-host audio for Sonic');
  const name = (sourceUrl.split('/').pop() || 'source.mp3').split('?')[0].replace(/[^\w.\-]/g, '_');
  return await pinFileFromUrl(sourceUrl, name);
}

async function uploadToSonic(audioUrl) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 60000);
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
      const providerMsg = data?.detail || data?.error || data?.message || `Upload failed (HTTP ${res.status})`;
      const combined = String(providerMsg).toLowerCase();
      const userMsg = (combined.includes('matches an existing recording') || combined.includes('catalog'))
        ? "Sonic blocked one of your tracks: the source audio matches a copyrighted commercial recording in their catalog. Try original, royalty-free, or AI-generated tracks instead."
        : providerMsg;
      const err = new Error(userMsg);
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
      assetIds = [],
      mv = 'sonic-v5',
      custom_mode = false,            // mashups usually use AI description
      prompt,
      gpt_description_prompt,
      title,
      tags,
      negative_tags,
      make_instrumental = false,
      style_weight,
      weirdness_constraint,
      audio_weight,
      vocal_gender,
      options = {},                    // legacy { bpm, key } — preserved for metadata only
    } = body;

    // ── Validation ───────────────────────────────────────────────────────────
    // Sonic mashup requires EXACTLY 2 clip IDs.
    if (assetIds.length !== 2) {
      return Response.json({ error: 'Sonic mashup requires exactly 2 source tracks' }, { status: 400 });
    }
    if (!SONIC_LIMITS[mv]) return Response.json({ error: `Invalid model: ${mv}` }, { status: 400 });
    if (custom_mode && (!prompt || !prompt.trim()) && !make_instrumental) {
      return Response.json({ error: 'Custom mode requires lyrics in `prompt` (or enable instrumental)' }, { status: 400 });
    }
    if (!custom_mode && (!gpt_description_prompt || !gpt_description_prompt.trim())) {
      return Response.json({ error: 'AI mode requires `gpt_description_prompt`' }, { status: 400 });
    }

    // ── Load source assets ───────────────────────────────────────────────────
    const sources = [];
    for (const id of assetIds) {
      const arr = await base44.entities.UserAsset.filter({ id });
      if (arr[0]) sources.push(arr[0]);
    }
    if (sources.length !== 2) {
      return Response.json({ error: 'One or more source assets not found' }, { status: 404 });
    }
    if (!sources[0].file_url || !sources[1].file_url) {
      return Response.json({ error: 'Source assets are missing audio URLs' }, { status: 400 });
    }

    // Legal separation guard: Loudly + Audius is not allowed
    const origins = new Set(sources.map(s => s.origin || 'creator'));
    if (origins.has('loudly') && origins.has('audius')) {
      return Response.json({
        error: 'Cannot mash Loudly catalog content with Audius content (legal separation).',
      }, { status: 403 });
    }

    // ── Credit gate ──────────────────────────────────────────────────────────
    const credits = await base44.asServiceRole.entities.UserCredit.filter({ user_id: user.id });
    const balance = credits[0]?.balance ?? 0;
    if (balance < MASHUP_COST) {
      return Response.json({
        error: 'Insufficient credits',
        required: MASHUP_COST, balance,
        message: `Mashup costs ${MASHUP_COST} credits. You have ${balance}.`,
      }, { status: 402 });
    }

    // ── Build mashup body (clip IDs filled in background) ────────────────────
    const limits = SONIC_LIMITS[mv];
    const tagParts = [tags].filter(Boolean).map(s => String(s).trim()).filter(Boolean);
    const mergedTags = tagParts.join(', ').slice(0, limits.tags);

    const mashupBody = {
      custom_mode: !!custom_mode,
      mv,
    };
    if (custom_mode) mashupBody.prompt = String(prompt || '').slice(0, limits.prompt);
    else             mashupBody.gpt_description_prompt = String(gpt_description_prompt).slice(0, limits.gpt);
    if (title)        mashupBody.title = String(title).slice(0, 80);
    if (mergedTags)   mashupBody.tags = mergedTags;
    if (negative_tags) mashupBody.negative_tags = String(negative_tags).slice(0, limits.tags);
    if (make_instrumental) mashupBody.make_instrumental = true;
    if (typeof style_weight === 'number')         mashupBody.style_weight = Math.max(0, Math.min(1, style_weight));
    if (typeof weirdness_constraint === 'number') mashupBody.weirdness_constraint = Math.max(0, Math.min(1, weirdness_constraint));
    if (typeof audio_weight === 'number')         mashupBody.audio_weight = Math.max(0, Math.min(1, audio_weight));
    if (vocal_gender && VOCAL_GENDER_MODELS.has(mv) && (vocal_gender === 'f' || vocal_gender === 'm')) {
      mashupBody.vocal_gender = vocal_gender;
    }
    const wh = getWebhookConfig();
    if (wh) Object.assign(mashupBody, wh);

    // ── Auto-detect BPM/key for metadata (informational only) ────────────────
    const bpms = sources.map(s => s.metadata?.bpm).filter(Boolean).sort((a, b) => a - b);
    const detectedBpm = options.bpm || bpms[Math.floor(bpms.length / 2)] || null;
    const detectedKey = options.key || sources.find(s => s.metadata?.key)?.metadata?.key || null;

    // ── Create GenerationJob and return immediately ──────────────────────────
    const generatedAt = new Date().toISOString();
    const mashupTitle = title || `Mashup — ${sources.map(s => s.title).join(' × ')}`.slice(0, 80);
    const job = await base44.entities.GenerationJob.create({
      user_id: user.id, user_email: user.email,
      job_type: 'music', provider: 'sonic',
      status: 'processing',
      ai_label: 'ai_generated', // RIAA GenAI label — AI generates the mashup recording
      input_data: {
        action: 'mashup',
        assetIds,
        source_titles: sources.map(s => s.title),
        source_urls: sources.map(s => s.file_url),
        mv,
        custom_mode: !!custom_mode,
        prompt: custom_mode ? String(prompt || '').slice(0, 500) : undefined,
        gpt_description_prompt: !custom_mode ? gpt_description_prompt : undefined,
        title: mashupTitle,
        tags: mergedTags,
        negative_tags,
        make_instrumental: !!make_instrumental,
        style_weight, weirdness_constraint, audio_weight,
        vocal_gender: mashupBody.vocal_gender || null,
        bpm: detectedBpm,
        key: detectedKey,
        model: mv,
        credit_cost: MASHUP_COST,
        task_kind: 'mashup',
        stage: 'uploading',
      },
      started_at: generatedAt,
    });

    base44.asServiceRole.entities.APIUsageLog.create({
      user_id: user.id, user_email: user.email, user_name: user.full_name,
      provider: 'sonic', task: 'generate_mashup',
      credits_used: 0, status: 'pending',
      timestamp: generatedAt, job_id: job.id,
      metadata: { model_version: mv, base44_job_id: job.id, task_kind: 'mashup', source_count: 2 },
    }).catch(() => {});

    // ── Background: rehost both sources → upload → mashup ───────────────────
    // IMPORTANT: wrapped in waitUntil so the Worker stays alive to finish
    // after we return the job_id. A bare fire-and-forget IIFE here was killed
    // when the handler returned, leaving jobs stuck in 'processing' at the
    // 'uploading' / 'sonic_upload' stage with provider_job_id never set.
    waitUntil((async () => {
      try {
        // Step 1: ensure both sources are publicly fetchable
        const publicUrls = await Promise.all(sources.map(s => ensurePublicUrl(s.file_url)));
        console.log('Mashup public URLs:', publicUrls);

        await base44.asServiceRole.entities.GenerationJob.update(job.id, {
          input_data: { ...job.input_data, public_urls: publicUrls, stage: 'sonic_upload' },
        });

        // Step 2: upload both to Sonic to get clip IDs
        const clipIds = [];
        for (const u of publicUrls) {
          const cid = await uploadToSonic(u);
          clipIds.push(cid);
        }
        console.log('Mashup clip IDs:', clipIds);

        await base44.asServiceRole.entities.GenerationJob.update(job.id, {
          input_data: { ...job.input_data, public_urls: publicUrls, mashup_clip_ids: clipIds, stage: 'sonic_mashup' },
        });

        // Step 3: call /sonic/mashup
        mashupBody.mashup_clip_ids = clipIds;
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 30000);
        let res, data;
        try {
          res = await fetch(`${AI_BASE}/sonic/mashup`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${SONIC_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(mashupBody),
            signal: controller.signal,
          });
          data = await res.json();
        } finally { clearTimeout(t); }

        console.log('Sonic mashup response status:', res.status, 'body:', JSON.stringify(data));
        const taskId = data?.task_id || data?.data?.task_id;
        if (!res.ok || !taskId) {
          const providerMsg = data?.detail || data?.error || data?.message || `Sonic HTTP ${res.status}`;
          await base44.asServiceRole.entities.GenerationJob.update(job.id, {
            status: 'failed',
            error_message: providerMsg,
            output_metadata: { sonic_response: data, sonic_http_status: res.status, clip_ids: clipIds },
            completed_at: new Date().toISOString(),
          });
          return;
        }

        await base44.asServiceRole.entities.GenerationJob.update(job.id, {
          provider_job_id: taskId,
          input_data: { ...job.input_data, public_urls: publicUrls, mashup_clip_ids: clipIds, stage: 'processing' },
        });
      } catch (e) {
        await base44.asServiceRole.entities.GenerationJob.update(job.id, {
          status: 'failed',
          error_message: e.message || 'Mashup submission failed',
          completed_at: new Date().toISOString(),
        }).catch(() => {});
      }
    })());

    return Response.json({
      job_id: job.id,
      status: 'processing',
      stage: 'uploading',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});