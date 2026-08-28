// generateVideoLTX — submits a video generation job to the current LTX API.
//
// Uses the ASYNC (V2) API: POST https://api.ltx.io/v2/{endpoint} returns 202
// with a job id, and pollGenerationJob → jobFinalize polls
// GET /v2/{endpoint}/{id}, persists the MP4 into our storage (LTX only keeps
// output URLs for 24h), deducts credits and saves the asset to the library.
//
// Payload: {
//   prompt, mode: 'text'|'image'|'audio',
//   model: 'ltx-2-5-fast'|'ltx-2-5-pro'|'ltx-2-3-fast'|'ltx-2-3-pro',
//   duration (number | null for auto), resolution_tier, aspect_ratio, fps,
//   camera_motion, generate_audio,
//   reference_image_url, reference_audio_url, last_frame_url
// }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  LTX_API_BASE, LTX_CAMERA_MOTIONS, LTX_MODELS,
  ltxCreditCost, ltxDurations, ltxMaxAudioSeconds, ltxNormalize,
} from '../../shared/ltxSpec.ts';
import { tryPrivateLtxVideo } from '../../shared/privateLtx.ts';

const LTX_API_KEY = Deno.env.get('LTX_API_KEY');

// LTX fetches inputs itself: HTTPS only, no redirects, public host.
function validMediaUri(url: string | undefined): boolean {
  return !!url && (/^https:\/\/[^/]+\./i.test(url) || /^ltx:\/\//i.test(url) || /^data:/i.test(url));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!LTX_API_KEY) return Response.json({ error: 'LTX_API_KEY not configured' }, { status: 500 });

    const body = await req.json();
    const {
      prompt, mode = 'text',
      model = 'ltx-2-5-fast',
      duration = 8,
      resolution_tier = '1080p',
      aspect_ratio = '16:9',
      fps = 24,
      camera_motion = '',
      generate_audio = true,
      reference_image_url, reference_audio_url, last_frame_url,
    } = body;

    const norm = ltxNormalize({ mode, model, tier: resolution_tier, fps, duration, aspect: aspect_ratio });
    if (norm.error) return Response.json({ error: norm.error }, { status: 400 });

    // Per-mode input requirements straight from the API reference
    if (mode === 'text' && !prompt) {
      return Response.json({ error: 'A prompt is required for text-to-video' }, { status: 400 });
    }
    if (mode === 'image') {
      if (!validMediaUri(reference_image_url)) {
        return Response.json({ error: 'Image-to-video needs a public https image URL' }, { status: 400 });
      }
      if (!prompt) return Response.json({ error: 'Describe how the image should move' }, { status: 400 });
    }
    if (mode === 'audio') {
      if (!validMediaUri(reference_audio_url)) {
        return Response.json({ error: 'Audio-to-video needs a public https audio URL' }, { status: 400 });
      }
      if (!prompt && !validMediaUri(reference_image_url)) {
        return Response.json({ error: 'Audio-to-video needs a prompt or a reference image' }, { status: 400 });
      }
    }
    // A fixed last frame pins the clip length, so it cannot ride with auto duration
    const wantsLastFrame = validMediaUri(last_frame_url) && (mode === 'image' || mode === 'audio');
    if (wantsLastFrame && mode === 'image' && norm.duration === null) {
      return Response.json({ error: 'A last frame requires a fixed duration — turn off Auto.' }, { status: 400 });
    }

    // Auto duration and audio-driven clips are billed against the model's ceiling
    const billedSeconds = norm.duration
      ?? (mode === 'audio'
        ? ltxMaxAudioSeconds(norm.model, norm.tier)
        : ltxDurations(norm.model, norm.tier, norm.fps).slice(-1)[0]);
    const cost = ltxCreditCost(norm.model, norm.tier, billedSeconds);

    const credits = await base44.asServiceRole.entities.UserCredit.filter({ user_id: user.id });
    const balance = credits[0]?.balance ?? 0;
    if (balance < cost) {
      return Response.json({
        error: 'Insufficient credits',
        required: cost, balance,
        message: `${billedSeconds}s of ${norm.tier} ${LTX_MODELS[norm.model].label} video costs ${cost} credits. You have ${balance}.`,
      }, { status: 402 });
    }

    // ── Node 1: private Hugging Face LTX engine (primary, text-to-video only) ──
    // Submit-and-poll: success returns the finished MP4 already persisted into
    // our storage. Any failure (Space asleep, busy, timeout, unfetchable output)
    // returns null and execution falls through to the public LTX path below —
    // Node 2's IF/ELSE is simply this null check. Invisible to the user: the
    // frontend already handles both a synchronous video_url and an async job_id.
    if (mode === 'text') {
      const priv = await tryPrivateLtxVideo(base44, { prompt, seed: body.seed });
      if (priv?.video_url) {
        const completedAt = new Date().toISOString();
        const privJob = await base44.entities.GenerationJob.create({
          user_id: user.id, user_email: user.email,
          job_type: 'video', provider: 'ltx',
          status: 'completed',
          input_data: {
            prompt, mode, model: 'ltx-2-5-private-hf', engine: 'hf_private',
            seed: priv.seed, resolution: '768x512', fps: 24, credit_cost: cost,
          },
          output_url: priv.video_url,
          output_metadata: { duration: 4, resolution: '768x512', fps: 24, model_version: 'ltx-2-5-private-hf' },
          credits_used: cost,
          started_at: completedAt, completed_at: completedAt,
        }).catch(() => ({ id: null }));

        // Save into the creator's library. The file_url is already our own
        // permanent storage copy (persisted at fetch time), never the pod URL.
        // BASE Mark / ID3 are audio-only and deliberately not applied to an
        // MP4; on-chain anchoring only covers whole audio works (opt-in), so
        // neither pipeline is triggered for a video asset.
        const title = (prompt || 'Generated video').slice(0, 60);
        const asset = await base44.entities.UserAsset.create({
          user_id: user.id, user_email: user.email,
          asset_type: 'video',
          title,
          file_url: priv.video_url,
          is_public: false,
          metadata: {
            prompt, seed: priv.seed,
            generated_at: completedAt,
            provider: 'ltx', engine: 'hf_private',
            model_version: 'ltx-2-5-private-hf',
            resolution: '768x512', fps: 24,
            generation_job_id: privJob?.id || null,
          },
        }).catch((e) => { console.warn('Asset save failed:', e.message); return null; });

        // Pin the MP4 to IPFS via the existing Pinata function and record the
        // CID on the asset. Non-fatal: a pin failure must not fail a finished
        // generation — the permanent storage copy is already the file of record.
        let ipfs = null;
        if (asset) {
          try {
            const pinRes = await base44.functions.invoke('pinToIPFS', {
              mode: 'file', file_url: priv.video_url, name: `${title}.mp4`,
            });
            if (pinRes?.data?.cid) {
              ipfs = pinRes.data;
              await base44.entities.UserAsset.update(asset.id, {
                metadata: { ...asset.metadata, generation_job_id: privJob?.id || null,
                  ipfs_cid: ipfs.cid, ipfs_uri: ipfs.ipfs_uri, ipfs_gateway_url: ipfs.gateway_url },
              }).catch(() => {});
            }
          } catch (e) { console.warn('IPFS pin failed (non-fatal):', e.message); }
        }

        // Deduct now — the async finalizer never sees a synchronously completed job.
        let remaining = balance;
        try {
          const rec = credits[0];
          if (rec) {
            remaining = Math.max(0, (rec.balance || 0) - cost);
            await base44.asServiceRole.entities.UserCredit.update(rec.id, {
              balance: remaining,
              lifetime_spent: (rec.lifetime_spent || 0) + cost,
              monthly_used: (rec.monthly_used || 0) + cost,
            });
            await base44.asServiceRole.entities.CreditLog.create({
              user_id: user.id, user_email: user.email,
              transaction_type: 'generation',
              amount: -cost,
              balance_before: rec.balance,
              balance_after: remaining,
              related_job_id: privJob?.id, provider: 'ltx',
              description: 'Private LTX engine video generation',
            }).catch(() => {});
          }
        } catch (e) { console.warn('Credit deduction failed:', e.message); }

        base44.asServiceRole.entities.APIUsageLog.create({
          user_id: user.id, user_email: user.email, user_name: user.full_name,
          provider: 'ltx', task: 'generate_video',
          credits_used: cost, status: 'success',
          timestamp: completedAt, job_id: privJob?.id || null,
          metadata: {
            model_version: 'ltx-2-5-private-hf',
            engine: 'hf_private',
            input_parameters: { prompt: (prompt || '').slice(0, 200), mode, seed: priv.seed, resolution: '768x512', fps: 24 },
            output_details: { video_url: priv.video_url },
          },
        }).catch(() => {});

        return Response.json({
          status: 'completed',
          video_url: priv.video_url,
          job_id: privJob?.id,
          asset_id: asset?.id || null,
          ipfs_cid: ipfs?.cid || null,
          ipfs_gateway_url: ipfs?.gateway_url || null,
          model: 'ltx-2-5-private-hf',
          credits_used: cost,
          credits_remaining: remaining,
        });
      }
      console.log('Private engine unavailable — routing to public LTX API');
    }

    // ── Node 3: public LTX API (fallback, and the only path for image/audio) ──

    // Build the request body exactly as the endpoint expects
    const ltxBody: Record<string, any> = {
      model: norm.model,
      resolution: norm.resolution,
      fps: norm.fps,
    };
    if (prompt) ltxBody.prompt = prompt;
    if (LTX_CAMERA_MOTIONS.includes(camera_motion)) ltxBody.camera_motion = camera_motion;
    if (wantsLastFrame) ltxBody.last_frame_uri = last_frame_url;

    if (mode === 'audio') {
      ltxBody.audio_uri = reference_audio_url;
      if (validMediaUri(reference_image_url)) ltxBody.image_uri = reference_image_url;
    } else {
      // duration is REQUIRED on text/image — null means "model picks the length"
      ltxBody.duration = norm.duration;
      ltxBody.generate_audio = generate_audio !== false;
      if (mode === 'image') ltxBody.image_uri = reference_image_url;
    }

    const job = await base44.entities.GenerationJob.create({
      user_id: user.id, user_email: user.email,
      job_type: 'video', provider: 'ltx',
      status: 'processing',
      input_data: {
        prompt, mode, model: norm.model,
        ltx_endpoint: norm.endpoint,
        duration: norm.duration, billed_seconds: billedSeconds,
        resolution: norm.resolution, resolution_tier: norm.tier,
        aspect_ratio, fps: norm.fps,
        camera_motion: ltxBody.camera_motion || null,
        generate_audio: ltxBody.generate_audio ?? null,
        has_last_frame: !!wantsLastFrame,
        credit_cost: cost,
      },
      started_at: new Date().toISOString(),
    });

    const ltxRes = await fetch(`${LTX_API_BASE}/v2/${norm.endpoint}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LTX_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(ltxBody),
    });

    const raw = await ltxRes.text();
    let data: any = {};
    try { data = JSON.parse(raw); } catch { /* non-JSON error body */ }

    if (!ltxRes.ok) {
      // LTX errors are { type, message } — surface the message, not the envelope
      const message = data?.error?.message || raw.slice(0, 500) || `LTX returned ${ltxRes.status}`;
      await base44.entities.GenerationJob.update(job.id, {
        status: 'failed', error_message: message, completed_at: new Date().toISOString(),
      });
      const status = ltxRes.status === 402 ? 402 : ltxRes.status === 422 ? 422 : 502;
      return Response.json({ error: message, job_id: job.id }, { status });
    }

    if (!data?.id) {
      await base44.entities.GenerationJob.update(job.id, {
        status: 'failed', error_message: 'LTX accepted the request but returned no job id',
      });
      return Response.json({ error: 'LTX returned no job id' }, { status: 502 });
    }

    await base44.entities.GenerationJob.update(job.id, { provider_job_id: data.id });

    await base44.asServiceRole.entities.APIUsageLog.create({
      user_id: user.id, user_email: user.email, user_name: user.full_name,
      provider: 'ltx', task: 'generate_video',
      credits_used: cost, status: 'pending',
      timestamp: new Date().toISOString(), job_id: job.id,
      metadata: {
        model_version: norm.model,
        input_parameters: {
          prompt: (prompt || '').slice(0, 200), mode,
          endpoint: norm.endpoint, resolution: norm.resolution,
          fps: norm.fps, duration: norm.duration,
        },
        provider_job_id: data.id,
      },
    }).catch(() => {});

    return Response.json({
      job_id: job.id,
      provider_job_id: data.id,
      status: 'processing',
      model: norm.model,
      resolution: norm.resolution,
      duration: norm.duration,
      credit_cost: cost,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});