import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { startSoundForge, extractSoundForgeAudioUrl, SOUNDFORGE_CREDIT_COST, SOUNDFORGE_MAX_DURATION } from '../../shared/soundForge.ts';

// BASE SoundForge — generates loops, one-shots, and sound effects from a text
// prompt. Built on the open-source Stable Audio Open model, wrapped in our own
// prompt presets and product identity (see shared/soundForge.ts).

async function deductCredits(base44, user, amount, jobId) {
  const recs = await base44.asServiceRole.entities.UserCredit.filter({ user_id: user.id });
  let record = recs[0];
  if (!record) {
    record = await base44.asServiceRole.entities.UserCredit.create({
      user_id: user.id, user_email: user.email, balance: 0, lifetime_earned: 0, lifetime_spent: 0,
    });
  }
  const newBalance = Math.max(0, (record.balance || 0) - amount);
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
    related_job_id: jobId, provider: 'soundforge',
    description: 'BASE SoundForge loop/sample generation',
  }).catch(() => {});
  return newBalance;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { prompt, category = 'loop', duration_seconds = 8, bpm } = await req.json();
    if (!prompt || !prompt.trim()) return Response.json({ error: 'prompt is required' }, { status: 400 });

    const cost = SOUNDFORGE_CREDIT_COST;
    const credits = await base44.asServiceRole.entities.UserCredit.filter({ user_id: user.id });
    const balance = credits[0]?.balance ?? 0;
    if (balance < cost) {
      return Response.json({
        error: 'Insufficient credits', required: cost, balance,
        message: `Generating a loop/sample costs ${cost} credits. You have ${balance}.`,
      }, { status: 402 });
    }

    const safeDuration = Math.min(Math.max(Number(duration_seconds) || 8, 1), SOUNDFORGE_MAX_DURATION);
    const fullPrompt = bpm ? `${bpm} BPM ${prompt}` : prompt;

    const replicateInput = {
      prompt: fullPrompt.slice(0, 500),
      seconds_total: safeDuration,
      steps: 100,
      cfg_scale: 6,
      seed: -1,
      batch_size: 1,
      sampler_type: 'dpmpp-3m-sde',
      seconds_start: 0,
      sigma_max: 500,
      sigma_min: 0.03,
      negative_prompt: '',
      init_noise_level: 1,
    };

    let pred;
    try {
      pred = await startSoundForge(replicateInput);
    } catch (err) {
      return Response.json({ error: err.message }, { status: 502 });
    }

    const generatedAt = new Date().toISOString();
    const baseInputData = { prompt, category, bpm: bpm || null, duration_seconds: safeDuration, credit_cost: cost };

    if (pred.status === 'succeeded') {
      const providerUrl = extractSoundForgeAudioUrl(pred.output);
      if (!providerUrl) return Response.json({ error: 'BASE SoundForge did not return audio output' }, { status: 502 });

      const r = await fetch(providerUrl);
      const blob = await r.blob();
      const safeName = prompt.replace(/[^\w.\-]/g, '_').slice(0, 60) || 'soundforge';
      const file = new File([blob], `${safeName}.wav`, { type: 'audio/wav' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      const job = await base44.entities.GenerationJob.create({
        user_id: user.id, user_email: user.email,
        job_type: 'loop', provider: 'soundforge',
        status: 'completed',
        ai_label: 'ai_generated',
        input_data: baseInputData,
        output_url: file_url,
        output_metadata: { duration: safeDuration, model_version: 'BASE SoundForge (Stable Audio Open 1.0)' },
        credits_used: cost,
        started_at: generatedAt, completed_at: generatedAt,
      });

      const remaining = await deductCredits(base44, user, cost, job.id);

      base44.asServiceRole.entities.APIUsageLog.create({
        user_id: user.id, user_email: user.email, user_name: user.full_name,
        provider: 'soundforge', task: 'generate_loop',
        credits_used: cost, status: 'success', timestamp: generatedAt, job_id: job.id,
        metadata: { prompt: prompt.slice(0, 200), category, duration_seconds: safeDuration },
      }).catch(() => {});

      return Response.json({
        status: 'completed', audio_url: file_url, job_id: job.id,
        credits_used: cost, credits_remaining: remaining,
      });
    }

    if (pred.status === 'failed' || pred.status === 'canceled') {
      return Response.json({ error: pred.error || 'BASE SoundForge generation failed' }, { status: 502 });
    }

    // Still processing — create job for pollGenerationJob to finish
    const job = await base44.entities.GenerationJob.create({
      user_id: user.id, user_email: user.email,
      job_type: 'loop', provider: 'soundforge',
      status: 'processing',
      ai_label: 'ai_generated',
      input_data: baseInputData,
      provider_job_id: pred.id,
      started_at: generatedAt,
    });

    return Response.json({ job_id: job.id, status: 'processing' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});