import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { resolveTier, startHarmonix, extractAudioUrl } from '../../shared/harmonix.ts';
import { markGeneratedAudio, FORENSIC_AUDIO_FORMAT } from '../../shared/harmonixForensics.ts';

async function checkCreditBalance(base44, user, requiredCredits) {
  const credits = await base44.asServiceRole.entities.UserCredit.filter({ user_id: user.id });
  const record = credits[0];
  const balance = record?.balance ?? 0;
  return { ok: balance >= requiredCredits, balance };
}

async function deductCredits(base44, user, amount, jobId, description) {
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
    related_job_id: jobId, provider: 'harmonix', description,
  }).catch(() => {});
  return newBalance;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { tier = 'pro', prompt, lyrics, duration = 60, title } = await req.json();
    if (!prompt || !prompt.trim()) return Response.json({ error: 'prompt is required' }, { status: 400 });

    const tierConfig = resolveTier(tier);
    const cost = tierConfig.credit_cost;

    const { ok: hasCredits, balance } = await checkCreditBalance(base44, user, cost);
    if (!hasCredits) {
      return Response.json({
        error: 'Insufficient credits', required: cost, balance,
        message: `This generation costs ${cost} credits. You have ${balance}.`,
      }, { status: 402 });
    }

    const safeDuration = Math.min(Math.max(Number(duration) || 60, 5), tierConfig.max_duration);
    const hasLyrics = !!(lyrics && lyrics.trim());

    // Vault is the forensic-native tier: ask the model for PCM WAV so the mark
    // can be embedded in-memory before the single upload. Other tiers stay mp3.
    const forensicNative = tier === 'vault';

    const replicateInput = {
      prompt: prompt.slice(0, 1000),
      lyrics: hasLyrics ? lyrics.slice(0, 3000) : '[Instrumental]',
      duration: safeDuration,
      inference_steps: tierConfig.inference_steps,
      seed: -1,
      batch_size: 1,
      audio_format: forensicNative ? FORENSIC_AUDIO_FORMAT : 'mp3',
    };

    let pred;
    try {
      pred = await startHarmonix(replicateInput);
    } catch (err) {
      return Response.json({ error: err.message }, { status: 502 });
    }

    const generatedAt = new Date().toISOString();
    const encoder = new TextEncoder();
    const hashBuf = await crypto.subtle.digest('SHA-256', encoder.encode(`${user.id}|harmonix|${tier}|${prompt}|${generatedAt}`));
    const contentHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    const baseInputData = {
      tier, tier_name: tierConfig.name,
      prompt, lyrics: lyrics || '', duration: safeDuration,
      title: title || '', credit_cost: cost,
    };

    // Settled synchronously within the 55s wait window (typical for ACE-Step)
    if (pred.status === 'succeeded') {
      const providerAudioUrl = extractAudioUrl(pred.output);
      if (!providerAudioUrl) return Response.json({ error: 'BASE-Harmonix did not return audio output' }, { status: 502 });

      const r = await fetch(providerAudioUrl);
      const safeName = (title || 'harmonix-track').replace(/[^\w.\-]/g, '_');

      // Forensic-native path: the generated master is marked in this function's
      // memory and uploaded ONCE — no intermediate save, no second marking job.
      let file;
      let markProvenance = null;
      let markSkipped = null;
      if (forensicNative) {
        const raw = new Uint8Array(await r.arrayBuffer());
        const res = markGeneratedAudio(raw, `${user.id}|${contentHash}`);
        markProvenance = res.provenance;
        markSkipped = res.skipped;
        file = new File([res.bytes], `${safeName}.wav`, { type: 'audio/wav' });
      } else {
        file = new File([await r.blob()], `${safeName}.mp3`, { type: 'audio/mpeg' });
      }
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      const job = await base44.entities.GenerationJob.create({
        user_id: user.id, user_email: user.email,
        job_type: 'music', provider: 'harmonix',
        status: 'completed',
        ai_label: 'ai_generated',
        input_data: baseInputData,
        output_url: file_url,
        output_metadata: {
          duration: safeDuration, tier, tier_name: tierConfig.name,
          model_version: 'ACE-Step v1.5', content_hash: contentHash,
          // Marked inline at generation time — only still "needs" marking if the
          // inline pass could not run (non-WAV output, unexpected container).
          needs_basemark: forensicNative && !markProvenance,
          ...(markProvenance ? { base_mark: markProvenance } : {}),
          ...(markSkipped ? { base_mark_skipped: markSkipped } : {}),
        },
        credits_used: cost,
        started_at: generatedAt,
        completed_at: generatedAt,
      });

      const remaining = await deductCredits(base44, user, cost, job.id, `${tierConfig.name} generation`);

      return Response.json({
        status: 'completed', audio_url: file_url, job_id: job.id,
        tier, tier_name: tierConfig.name,
        needs_basemark: forensicNative && !markProvenance,
        base_mark: markProvenance,
        content_hash: contentHash,
        credits_used: cost, credits_remaining: remaining,
      });
    }

    if (pred.status === 'failed' || pred.status === 'canceled') {
      return Response.json({ error: pred.error || 'BASE-Harmonix generation failed' }, { status: 502 });
    }

    // Still processing after the wait window — create job for pollGenerationJob to finish
    const job = await base44.entities.GenerationJob.create({
      user_id: user.id, user_email: user.email,
      job_type: 'music', provider: 'harmonix',
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