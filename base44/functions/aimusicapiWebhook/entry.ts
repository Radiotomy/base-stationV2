// aimusicapi.ai webhook receiver — Sonic, Nuro, Producer
// Receives POST {code, data, message, task_id, platform, event} when a task settles.
// Verifies HMAC-SHA256 signature, finds the matching GenerationJob, applies the same
// completion logic as pollGenerationJob (credit deduction, content hash, log finalization).
//
// Headers from the provider:
//   X-Webhook-Id        — unique event id (idempotency)
//   X-Webhook-Event     — "song.completed" | "song.failed" | "song.streaming"
//   X-Webhook-Timestamp — Unix seconds when payload was signed
//   X-Webhook-Signature — "sha256=<hex>" computed as HMAC_SHA256(secret, `${timestamp}.${rawBody}`)
//
// Replay protection: reject timestamps outside ±5 minute window.
//
// IMPORTANT: This endpoint is intentionally PUBLIC (no base44.auth.me() check) —
// the provider calls it directly. Trust comes from HMAC signature verification.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { finalizeMashupAsset } from '../../shared/mashupFinalize.ts';

const WEBHOOK_SECRET = Deno.env.get('AIMUSICAPI_WEBHOOK_SECRET') || '';

async function verifySignature(rawBody, timestamp, signatureHeader) {
  if (!WEBHOOK_SECRET) throw new Error('AIMUSICAPI_WEBHOOK_SECRET not configured');
  const provided = (signatureHeader || '').replace(/^sha256=/i, '').trim();
  if (!provided || !timestamp) return false;

  const message = `${timestamp}.${rawBody}`;
  const keyData = new TextEncoder().encode(WEBHOOK_SECRET);
  const msgData = new TextEncoder().encode(message);
  const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sigBuf = await crypto.subtle.sign('HMAC', key, msgData);
  const expected = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

  if (provided.length !== expected.length) return false;
  // Constant-time compare
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  return diff === 0;
}

// Normalize the provider payload into the same shape pollGenerationJob produces
function normalizePayload(body) {
  const platform = body.platform || '';
  const event = body.event || '';
  const failed = event.endsWith('.failed') || body.code !== 200;

  if (platform === 'sonic') {
    const clips = Array.isArray(body.data) ? body.data : [];
    const succeeded = clips.filter(c => c.state === 'succeeded' && c.audio_url);
    if (failed && succeeded.length === 0) {
      return { task_id: body.task_id, provider: 'sonic', status: 'failed', error: body.message || 'Sonic generation failed' };
    }
    if (succeeded.length === 0) return { task_id: body.task_id, provider: 'sonic', status: 'processing' };
    const primary = succeeded[0];
    return {
      task_id: body.task_id, provider: 'sonic', status: 'completed',
      audio_url: primary.audio_url,
      audio_urls: succeeded.map(c => c.audio_url),
      cover_image_url: primary.image_url,
      cover_image_urls: succeeded.map(c => c.image_url).filter(Boolean),
      video_urls: succeeded.map(c => c.video_url).filter(Boolean),
      lyrics: primary.lyrics || '',
      title: primary.title || '',
      tags: primary.tags || '',
      duration: primary.duration ? Number(primary.duration) : undefined,
      model_version: primary.mv,
      clip_id: primary.clip_id,
      clip_ids: succeeded.map(c => c.clip_id).filter(Boolean),
    };
  }

  if (platform === 'nuro') {
    if (failed) return { task_id: body.task_id, provider: 'nuro', status: 'failed', error: body.message || 'Nuro generation failed' };
    const d = body.data || body;
    if (!d.audio_url) return { task_id: body.task_id, provider: 'nuro', status: 'processing' };
    return {
      task_id: body.task_id, provider: 'nuro', status: 'completed',
      audio_url: d.audio_url,
      lyrics: d.lyrics || '',
      duration: d.duration,
      genre: d.genre,
      mood: d.mood,
      vocal_gender: d.gender,
      vocal_timbre: d.timbre,
    };
  }

  if (platform === 'producer') {
    if (failed) return { task_id: body.task_id, provider: 'producer', status: 'failed', error: body.message || 'Producer generation failed' };
    const clip = Array.isArray(body.data) && body.data.length > 0 ? body.data[0] : null;
    if (!clip?.audio_url) return { task_id: body.task_id, provider: 'producer', status: 'processing' };
    return {
      task_id: body.task_id, provider: 'producer', status: 'completed',
      audio_url: clip.audio_url,
      cover_image_url: clip.image_url,
      wav_url: clip.wav_url,
      lyrics: clip.lyrics || clip.lyric || '',
      title: clip.title || '',
      tags: clip.tags || '',
      duration: clip.duration,
      clip_id: clip.clip_id,
    };
  }

  return { task_id: body.task_id, provider: platform, status: 'processing' };
}

// SSRF guard — only allow public http(s) hostnames, never IP literals or internal hosts
function isSafeUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  const host = u.hostname.toLowerCase();
  const ipv4 = /^\d{1,3}(\.\d{1,3}){3}$/;
  if (
    ipv4.test(host) || host.includes(':') ||
    host === 'localhost' || host.endsWith('.localhost') ||
    host.endsWith('.local') || host.endsWith('.internal') ||
    !host.includes('.')
  ) return false;
  return true;
}

// Copy an external provider URL into Base44 storage so files persist
// (provider CDN links expire and block CORS). Falls back to original URL.
async function persistUrl(base44, url, filename) {
  try {
    if (!url || /base44/i.test(url)) return url;
    if (!isSafeUrl(url)) return null; // never fetch or store internal/unsafe URLs
    const r = await fetch(url);
    if (!r.ok) return url;
    const blob = await r.blob();
    const safeName = (filename || 'file').replace(/[^\w.\-]/g, '_');
    const file = new File([blob], safeName, { type: blob.type || 'application/octet-stream' });
    const up = await base44.asServiceRole.integrations.Core.UploadFile({ file });
    return up?.file_url || url;
  } catch {
    return url;
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const rawBody = await req.text();
    const timestamp = req.headers.get('x-webhook-timestamp') || '';
    const signature = req.headers.get('x-webhook-signature') || '';
    const eventId = req.headers.get('x-webhook-id') || crypto.randomUUID();

    // 1. Verify HMAC signature
    const valid = await verifySignature(rawBody, timestamp, signature);
    if (!valid) {
      console.warn('Webhook signature verification failed', { eventId });
      return new Response('Invalid signature', { status: 401 });
    }

    // 2. Replay protection (±5 min)
    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
      return new Response('Timestamp expired', { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const normalized = normalizePayload(body);
    console.log('Webhook received', { eventId, platform: body.platform, event: body.event, status: normalized.status });

    // Streaming/processing events are informational only — ack and return
    if (normalized.status === 'processing') {
      return Response.json({ ok: true, status: 'processing' });
    }

    // 3. Find the matching job via service role (no user context here)
    const base44 = createClientFromRequest(req);
    const jobs = await base44.asServiceRole.entities.GenerationJob.filter({ provider_job_id: normalized.task_id });
    const job = jobs[0];
    if (!job) {
      console.warn('Webhook: no GenerationJob found for task_id', normalized.task_id);
      // Still 200 — provider should not retry; the user can re-poll if needed.
      return Response.json({ ok: true, warning: 'job_not_found' });
    }

    // 4. Idempotency — skip if already settled
    if (job.status === 'completed' || job.status === 'failed') {
      return Response.json({ ok: true, status: job.status, idempotent: true });
    }

    // 5. Apply same completion logic as pollGenerationJob
    if (normalized.status === 'failed') {
      await base44.asServiceRole.entities.GenerationJob.update(job.id, {
        status: 'failed', error_message: normalized.error,
      });
      return Response.json({ ok: true, status: 'failed' });
    }

    // status === 'completed'
    // Persist all generated files to Base44 storage upon creation
    const baseName = (normalized.title || job.job_type || 'output').slice(0, 60);
    if (normalized.audio_urls?.length) {
      normalized.audio_urls = await Promise.all(
        normalized.audio_urls.map((u, i) => persistUrl(base44, u, `${baseName}_${i + 1}.mp3`))
      );
      normalized.audio_url = normalized.audio_urls[0];
    } else if (normalized.audio_url) {
      normalized.audio_url = await persistUrl(base44, normalized.audio_url, `${baseName}.mp3`);
    }
    if (normalized.video_url) normalized.video_url = await persistUrl(base44, normalized.video_url, `${baseName}.mp4`);
    if (normalized.wav_url) normalized.wav_url = await persistUrl(base44, normalized.wav_url, `${baseName}.wav`);
    if (normalized.cover_image_url) normalized.cover_image_url = await persistUrl(base44, normalized.cover_image_url, `${baseName}_cover.jpg`);

    const outputUrl = normalized.audio_url || normalized.video_url;
    const completedAt = new Date().toISOString();

    // Cover art fallback — Sonic/Producer normally include image_url, but if a clip
    // arrives without one, generate album artwork so every track has a cover.
    if (job.job_type === 'music' && !normalized.cover_image_url) {
      try {
        const meta = job.input_data || {};
        const img = await base44.asServiceRole.integrations.Core.GenerateImage({
          prompt: `Album cover artwork for a ${meta.mood || 'modern'} ${meta.genre || ''} song titled "${normalized.title || meta.sound_prompt || 'Untitled'}". Professional music album cover, square composition, bold striking visual style true to the ${meta.genre || 'modern'} genre, no text or lettering.`,
        });
        if (img?.url) normalized.cover_image_url = img.url;
      } catch (e) { console.warn('Webhook cover art fallback failed:', e.message); }
    }
    const stampedCost = job.input_data?.credit_cost;
    const cost = stampedCost ?? 10;

    // Merge provider-returned lyrics with user-provided lyrics
    const finalLyrics = (job.input_data?.lyrics && job.input_data.lyrics.trim().length > 0)
      ? job.input_data.lyrics
      : (normalized.lyrics || '');

    await base44.asServiceRole.entities.GenerationJob.update(job.id, {
      status: 'completed',
      output_url: outputUrl,
      // RIAA GenAI label — stamp legacy music jobs created before labeling rollout
      ...(job.job_type === 'music' && { ai_label: job.ai_label || 'ai_generated' }),
      output_metadata: {
        bpm: normalized.bpm, key: normalized.key,
        duration: normalized.duration || job.input_data?.duration,
        cover_image_url: normalized.cover_image_url,
        audio_urls: normalized.audio_urls || null,
        cover_image_urls: normalized.cover_image_urls || null,
        video_urls: normalized.video_urls || null,
        wav_url: normalized.wav_url || null,
        lyrics: finalLyrics,
        title: normalized.title || '',
        tags: normalized.tags || '',
        genre: normalized.genre || job.input_data?.genre,
        mood: normalized.mood || job.input_data?.mood,
        vocal_gender: normalized.vocal_gender || null,
        vocal_timbre: normalized.vocal_timbre || null,
        model_version: normalized.model_version || job.input_data?.model || null,
        clip_id: normalized.clip_id || null,
        clip_ids: normalized.clip_ids || null,
        delivered_via: 'webhook',
        webhook_event_id: eventId,
      },
      credits_used: cost,
      completed_at: completedAt,
    });

    // Deduct credits once
    if (!job.credits_used || job.credits_used === 0) {
      try {
        const recs = await base44.asServiceRole.entities.UserCredit.filter({ user_id: job.user_id });
        let record = recs[0];
        if (!record) {
          record = await base44.asServiceRole.entities.UserCredit.create({
            user_id: job.user_id, user_email: job.user_email,
            balance: 0, lifetime_earned: 0, lifetime_spent: 0,
          });
        }
        const newBalance = Math.max(0, (record.balance || 0) - cost);
        await base44.asServiceRole.entities.UserCredit.update(record.id, {
          balance: newBalance,
          lifetime_spent: (record.lifetime_spent || 0) + cost,
          monthly_used: (record.monthly_used || 0) + cost,
        });
        await base44.asServiceRole.entities.CreditLog.create({
          user_id: job.user_id, user_email: job.user_email,
          transaction_type: 'generation',
          amount: -cost,
          balance_before: record.balance,
          balance_after: newBalance,
          related_job_id: job.id, provider: job.provider,
          description: `${job.provider} ${job.job_type} generation (webhook)`,
        });
      } catch (e) { console.warn('Webhook credit deduction failed:', e.message); }
    }

    // Server-side library save for mashups — decoupled from the user staying on
    // the MashupStudio page. Idempotent; no-op for non-mashup jobs.
    if (job.input_data?.task_kind === 'mashup') {
      await finalizeMashupAsset(base44, job.id);
    }

    // Finalize pending API usage log
    try {
      const enc = new TextEncoder();
      const hashInput = `${job.user_id}|${job.provider}|${job.provider_job_id}|${outputUrl}|${completedAt}`;
      const hashBuf = await crypto.subtle.digest('SHA-256', enc.encode(hashInput));
      const contentHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

      const existingLogs = await base44.asServiceRole.entities.APIUsageLog.filter({ job_id: job.id });
      const pendingLog = existingLogs.find(l => l.status === 'pending');
      const logPayload = {
        status: 'success', credits_used: cost, timestamp: completedAt,
        metadata: {
          model_version: normalized.model_version || job.input_data?.model || job.provider,
          input_parameters: job.input_data || {},
          output_details: {
            audio_url: job.job_type === 'music' ? outputUrl : undefined,
            video_url: job.job_type === 'video' ? outputUrl : undefined,
            duration: normalized.duration || job.input_data?.duration,
          },
          provider_job_id: job.provider_job_id,
          base44_job_id: job.id,
          generated_timestamp: completedAt,
          content_hash: contentHash,
          delivered_via: 'webhook',
        },
      };
      if (pendingLog) {
        await base44.asServiceRole.entities.APIUsageLog.update(pendingLog.id, logPayload);
      } else {
        await base44.asServiceRole.entities.APIUsageLog.create({
          user_id: job.user_id, user_email: job.user_email,
          provider: job.provider, task: `generate_${job.job_type}`,
          job_id: job.id, ...logPayload,
        });
      }
    } catch (e) { console.warn('Log finalize failed:', e.message); }

    return Response.json({ ok: true, status: 'completed', job_id: job.id });
  } catch (error) {
    console.error('Webhook handler error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});