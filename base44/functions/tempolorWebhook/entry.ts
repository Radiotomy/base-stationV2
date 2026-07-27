// Tempolor webhook receiver — Song & Instrumental generation callbacks.
//
// Tempolor pushes up to 3 sequential callbacks per task:
//   1. audio_complete       — mp3 ready (audio_url)
//   2. wav_complete         — lossless wav ready (audio_hi_url)
//   3. lrcsections_complete — line-level lyrics alignment ready
//
// Payload shape (POST application/json):
//   { songs: [{ item_id, status, audio_hi_status, lyrics_sections_status,
//     event, model, title, style, prompt, duration, created_at, finished_at,
//     audio_url, audio_hi_url, lyrics, lyrics_sections: [{ start, end, text }] }] }
//
// Tempolor expects the response body string "success" to acknowledge.
//
// Auth model: Tempolor does NOT sign callbacks. We require the caller to include
// our shared secret in the URL as ?secret=<TEMPOLOR_WEBHOOK_SECRET> when the secret
// is configured. If TEMPOLOR_WEBHOOK_SECRET is not set, we accept all callbacks
// (suitable for dev/testing only).
//
// Multiple callbacks per task are handled idempotently — each call MERGES new
// fields onto the existing GenerationJob.output_metadata without overwriting
// data from earlier callbacks.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const WEBHOOK_SECRET = Deno.env.get('TEMPOLOR_WEBHOOK_SECRET') || '';

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

function ackSuccess() {
  // Tempolor docs: "If the request is successful, please return: success"
  return new Response('success', { status: 200, headers: { 'Content-Type': 'text/plain' } });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    // Shared-secret check — REQUIRED. Tempolor doesn't sign callbacks, so the
    // shared secret is the trust boundary; fail closed if it isn't configured.
    if (!WEBHOOK_SECRET) {
      console.error('Tempolor webhook: TEMPOLOR_WEBHOOK_SECRET not configured — rejecting');
      return new Response('Webhook not configured', { status: 503 });
    }
    const url = new URL(req.url);
    const provided = url.searchParams.get('secret') || req.headers.get('x-tempolor-secret') || '';
    // Constant-time comparison to prevent timing attacks
    let mismatch = provided.length === WEBHOOK_SECRET.length ? 0 : 1;
    for (let i = 0; i < WEBHOOK_SECRET.length; i++) {
      mismatch |= WEBHOOK_SECRET.charCodeAt(i) ^ (provided.charCodeAt(i) || 0);
    }
    if (mismatch !== 0) {
      console.warn('Tempolor webhook: invalid secret');
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const songs = Array.isArray(body?.songs) ? body.songs : [];
    if (songs.length === 0) {
      console.warn('Tempolor webhook: no songs in payload');
      return ackSuccess();
    }

    const base44 = createClientFromRequest(req);

    for (const song of songs) {
      const itemId = song.item_id;
      const event = song.event || '';
      if (!itemId) continue;

      // Find the matching GenerationJob by provider_job_id (= Tempolor item_id)
      const jobs = await base44.asServiceRole.entities.GenerationJob.filter({ provider_job_id: itemId });
      const job = jobs[0];
      if (!job) {
        console.warn(`Tempolor webhook: no job found for item_id=${itemId}`);
        continue;
      }

      // Idempotency: skip if already failed (terminal)
      if (job.status === 'failed') continue;

      const st = song.status || '';
      const existingMeta = job.output_metadata || {};

      // Failure callback
      if (st === 'failed' || st === 'part_failed') {
        await base44.asServiceRole.entities.GenerationJob.update(job.id, {
          status: 'failed',
          error_message: song.err_msg || 'Tempolor generation failed',
        });
        continue;
      }

      // Normalize lyrics_sections (line-level) → aligned_lyrics format we use for SYLT
      const aligned = Array.isArray(song.lyrics_sections)
        ? song.lyrics_sections
            .map(s => ({ word: s.text || '', start_s: Number(s.start), end_s: Number(s.end) }))
            .filter(s => Number.isFinite(s.start_s))
        : null;

      // Merge new fields onto existing metadata (each callback adds different data)
      const mergedMeta = {
        ...existingMeta,
        title: song.title || existingMeta.title || '',
        tags: song.style || existingMeta.tags || '',
        duration: song.duration || existingMeta.duration,
        model_version: song.model || existingMeta.model_version || job.input_data?.model || null,
        lyrics: song.lyrics || existingMeta.lyrics || job.input_data?.lyrics || '',
        wav_url: song.audio_hi_url || existingMeta.wav_url || null,
        cover_image_url: song.image_url || song.cover_url || existingMeta.cover_image_url || null,
        aligned_lyrics: aligned || existingMeta.aligned_lyrics || null,
        delivered_via: 'webhook',
        last_event: event,
      };

      let audioUrl = song.audio_url || existingMeta.audio_url || job.output_url;
      const isFinal = st === 'succeeded' || st === 'main_succeeded';
      const wasAlreadyCompleted = job.status === 'completed';

      // Persist generated files to Base44 storage upon creation
      const baseName = (mergedMeta.title || 'track').slice(0, 60);
      if (isFinal && audioUrl) audioUrl = await persistUrl(base44, audioUrl, `${baseName}.mp3`);
      if (mergedMeta.wav_url) mergedMeta.wav_url = await persistUrl(base44, mergedMeta.wav_url, `${baseName}.wav`);
      if (mergedMeta.cover_image_url) mergedMeta.cover_image_url = await persistUrl(base44, mergedMeta.cover_image_url, `${baseName}_cover.jpg`);
      if (isFinal && audioUrl) mergedMeta.audio_url = audioUrl;

      // First time we have audio → mark completed + deduct credits + finalize log.
      // Subsequent callbacks (wav_complete, lrcsections_complete) just merge metadata.
      if (isFinal && audioUrl && !wasAlreadyCompleted) {
        const completedAt = new Date().toISOString();
        const cost = job.input_data?.credit_cost ?? 10;

        // Cover art fallback — Tempolor models don't produce album artwork.
        // Generate one so the track lands in the library with a cover like Sonic/Producer tracks.
        if (!mergedMeta.cover_image_url) {
          try {
            const meta = job.input_data || {};
            const img = await base44.asServiceRole.integrations.Core.GenerateImage({
              prompt: `Album cover artwork for a ${meta.mood || 'modern'} ${meta.genre || ''} song titled "${mergedMeta.title || meta.sound_prompt || 'Untitled'}". Professional music album cover, square composition, bold striking visual style true to the ${meta.genre || 'modern'} genre, no text or lettering.`,
            });
            if (img?.url) mergedMeta.cover_image_url = img.url;
          } catch (e) { console.warn('Tempolor cover art fallback failed:', e.message); }
        }

        await base44.asServiceRole.entities.GenerationJob.update(job.id, {
          status: 'completed',
          output_url: audioUrl,
          output_metadata: mergedMeta,
          credits_used: cost,
          completed_at: completedAt,
        });

        // Credit deduction (guard against double-charging)
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
              related_job_id: job.id, provider: 'tempcolor',
              description: 'tempcolor music generation (webhook)',
            });
          } catch (e) { console.warn('Tempolor credit deduction failed:', e.message); }
        }

        // Finalize pending APIUsageLog
        try {
          const enc = new TextEncoder();
          const hashInput = `${job.user_id}|tempcolor|${itemId}|${audioUrl}|${completedAt}`;
          const hashBuf = await crypto.subtle.digest('SHA-256', enc.encode(hashInput));
          const contentHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

          const existingLogs = await base44.asServiceRole.entities.APIUsageLog.filter({ job_id: job.id });
          const pendingLog = existingLogs.find(l => l.status === 'pending');
          const logPayload = {
            status: 'success', credits_used: cost, timestamp: completedAt,
            metadata: {
              model_version: mergedMeta.model_version || 'TemPolor',
              input_parameters: job.input_data || {},
              output_details: { audio_url: audioUrl, duration: mergedMeta.duration },
              provider_job_id: itemId, base44_job_id: job.id,
              generated_timestamp: completedAt, content_hash: contentHash,
              delivered_via: 'webhook',
            },
          };
          if (pendingLog) {
            await base44.asServiceRole.entities.APIUsageLog.update(pendingLog.id, logPayload);
          } else {
            await base44.asServiceRole.entities.APIUsageLog.create({
              user_id: job.user_id, user_email: job.user_email,
              provider: 'tempcolor', task: 'generate_music',
              job_id: job.id, ...logPayload,
            });
          }
        } catch (e) { console.warn('Tempolor log finalize failed:', e.message); }
      } else {
        // Mid-flight callback (wav_complete or lrcsections_complete after audio_complete already
        // finalized the job) — just merge metadata onto the already-completed job.
        await base44.asServiceRole.entities.GenerationJob.update(job.id, {
          output_metadata: mergedMeta,
        });
      }
    }

    return ackSuccess();
  } catch (error) {
    console.error('Tempolor webhook error:', error.message, error.stack);
    // Still return success so Tempolor doesn't endlessly retry on parse errors
    return ackSuccess();
  }
});