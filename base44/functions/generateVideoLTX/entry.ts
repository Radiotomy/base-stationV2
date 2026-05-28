import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const LTX_API_KEY = Deno.env.get('LTX_API_KEY');

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

    if (!LTX_API_KEY) return Response.json({ error: 'LTX_API_KEY not configured' }, { status: 500 });

    const { prompt, duration = 5, aspect_ratio = '16:9', mode = 'text', reference_image_url, reference_audio_url } = await req.json();
    if (!prompt) return Response.json({ error: 'Missing prompt' }, { status: 400 });

    // Cost: 2 credits per second of video
    const cost = Math.max(2, Math.round(duration * 2));

    // Pre-check credit balance
    const credits = await base44.asServiceRole.entities.UserCredit.filter({ user_id: user.id });
    const balance = credits[0]?.balance ?? 0;
    if (balance < cost) {
      return Response.json({
        error: 'Insufficient credits',
        required: cost, balance,
        message: `${duration}s of video costs ${cost} credits. You have ${balance}.`,
      }, { status: 402 });
    }

    // Create job record
    const job = await base44.entities.GenerationJob.create({
      user_id: user.id, user_email: user.email,
      job_type: 'video', provider: 'ltx',
      status: 'processing',
      input_data: { prompt, duration, aspect_ratio, mode, credit_cost: cost },
      started_at: new Date().toISOString(),
    });

    // Build request body based on mode
    const ltxBody = { prompt, duration, aspect_ratio, style: 'cinematic' };
    if (mode === 'image' && reference_image_url) ltxBody.reference_image_url = reference_image_url;
    if (mode === 'audio' && reference_audio_url) ltxBody.reference_audio_url = reference_audio_url;

    // Call LTX Video API
    const ltxRes = await fetch('https://api.ltx.video/v1/video/generate', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LTX_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(ltxBody),
    });

    if (!ltxRes.ok) {
      const errText = await ltxRes.text();
      await base44.entities.GenerationJob.update(job.id, { status: 'failed', error_message: errText });
      return Response.json({ error: 'LTX error: ' + errText }, { status: 502 });
    }

    const result = await ltxRes.json();

    // If synchronous response with video_url
    if (result.video_url) {
      await base44.entities.GenerationJob.update(job.id, {
        status: 'completed',
        output_url: result.video_url,
        output_metadata: { duration, aspect_ratio, format: 'mp4' },
        credits_used: cost,
        completed_at: new Date().toISOString(),
      });

      // Deduct credits on sync success
      await deductCreditsServerSide(base44, user, cost, {
        provider: 'ltx', job_id: job.id, description: `LTX video (${duration}s)`,
      });

      const enc = new TextEncoder();
      const hashBuf = await crypto.subtle.digest('SHA-256', enc.encode(`${user.id}|ltx|${prompt}|${duration}|${aspect_ratio}|${new Date().toISOString()}`));
      const contentHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

      await base44.asServiceRole.entities.APIUsageLog.create({
        user_id: user.id, user_email: user.email, user_name: user.full_name,
        provider: 'ltx', task: 'generate_video',
        credits_used: cost, status: 'success',
        timestamp: new Date().toISOString(), job_id: job.id,
        metadata: {
          model_version: 'ltx-video-v1',
          input_parameters: { prompt: prompt.slice(0, 200), duration, aspect_ratio, mode },
          output_details: { video_url: result.video_url, duration, aspect_ratio, format: 'mp4' },
          generated_timestamp: new Date().toISOString(),
          content_hash: contentHash,
        },
      }).catch(() => {});

      return Response.json({ job_id: job.id, status: 'completed', video_url: result.video_url, duration, aspect_ratio, credits_used: cost });
    }

    // Async task
    if (result.task_id || result.id) {
      const providerJobId = result.task_id || result.id;
      await base44.entities.GenerationJob.update(job.id, {
        status: 'processing', provider_job_id: providerJobId,
      });
      return Response.json({ job_id: job.id, provider_job_id: providerJobId, status: 'processing' });
    }

    await base44.entities.GenerationJob.update(job.id, { status: 'failed', error_message: 'No output received' });
    return Response.json({ error: 'No output received from LTX' }, { status: 502 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});