// generateCoverArtTiered — cover artwork for the Cover Art Studio.
//
// Renders with the platform's own image model. The previous implementation
// POSTed to https://api.tempolor.com/v1/image/generate, which does not exist
// (Tempolor is a music API), and it read {track_title, mood, style} while the
// studio sends {prompt, quality} — so every request failed twice over: an
// undefined prompt sent to a dead endpoint, then an update on an undefined
// job id. Both are fixed here.
//
// Tiers match what the studio actually advertises on its buttons:
//   cheap  — chip-composed prompt ......... 1 credit
//   modest — creator's own custom prompt .. 3 credits

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { buildTrackCoverPrompt } from '../../shared/trackCoverArt.ts';

const TIERS = {
  cheap: { credits: 1, label: 'Cheap' },
  modest: { credits: 3, label: 'Modest' },
};

async function deductCreditsServerSide(base44, user, amount, { provider, job_id, description }) {
  const recs = await base44.asServiceRole.entities.UserCredit.filter({ user_id: user.id });
  let record = recs[0];
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

    const body = await req.json();
    const { prompt, quality = 'cheap' } = body;

    // Legacy callers passed structured fields instead of a prompt — still honored
    // so an older surface cannot silently break.
    const finalPrompt = (prompt && String(prompt).trim())
      || buildTrackCoverPrompt({ title: body.track_title, mood: body.mood, genre: body.style });
    if (!finalPrompt) return Response.json({ error: 'prompt is required' }, { status: 400 });

    const tier = TIERS[quality] || TIERS.cheap;

    const recs = await base44.asServiceRole.entities.UserCredit.filter({ user_id: user.id });
    const balance = recs[0]?.balance ?? 0;
    if (balance < tier.credits) {
      return Response.json({
        error: 'Insufficient credits',
        required: tier.credits, balance,
        message: `${tier.label} cover art costs ${tier.credits} credits. You have ${balance}.`,
      }, { status: 402 });
    }

    const job = await base44.entities.GenerationJob.create({
      user_id: user.id, user_email: user.email,
      job_type: 'cover_art', provider: 'core',
      status: 'processing',
      input_data: { prompt: finalPrompt.slice(0, 1000), quality, credit_cost: tier.credits },
      started_at: new Date().toISOString(),
    });

    let imageUrl;
    try {
      const img = await base44.integrations.Core.GenerateImage({ prompt: finalPrompt });
      imageUrl = img?.url;
      if (!imageUrl) throw new Error('Image model returned no image');
    } catch (err) {
      await base44.entities.GenerationJob.update(job.id, {
        status: 'failed',
        error_message: err.message,
        completed_at: new Date().toISOString(),
      });
      return Response.json({ error: err.message }, { status: 502 });
    }

    await base44.entities.GenerationJob.update(job.id, {
      status: 'completed',
      output_url: imageUrl,
      output_metadata: { quality, tier: tier.label },
      credits_used: tier.credits,
      completed_at: new Date().toISOString(),
    });

    const ded = await deductCreditsServerSide(base44, user, tier.credits, {
      provider: 'core', job_id: job.id, description: `Cover art (${tier.label})`,
    });

    return Response.json({
      job_id: job.id,
      status: 'completed',
      image_url: imageUrl,
      credits_used: tier.credits,
      credits_remaining: ded.balance,
      tier: tier.label,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});