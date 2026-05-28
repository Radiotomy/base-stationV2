import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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

    const { track_title, mood, style, tier = 'auto', job_id } = await req.json();
    const apiKey = Deno.env.get('TEMPCOLOR_API_KEY');
    if (!apiKey) return Response.json({ error: 'API key not configured' }, { status: 500 });

    // Tiered strategy: 'auto' = low-cost, 'deep' = higher quality
    const qualityTier = tier === 'deep' ? 'high' : 'standard';
    const credits = tier === 'deep' ? 50 : 10; // Estimated credit costs

    // Pre-check credit balance
    const recs = await base44.asServiceRole.entities.UserCredit.filter({ user_id: user.id });
    const balance = recs[0]?.balance ?? 0;
    if (balance < credits) {
      return Response.json({
        error: 'Insufficient credits',
        required: credits, balance,
        message: `${tier === 'deep' ? 'Deep' : 'Standard'} cover art costs ${credits} credits. You have ${balance}.`,
      }, { status: 402 });
    }

    // Call Tempcolor API - https://platform.tempolor.com/docs
    const tempcolorResponse = await fetch('https://api.tempolor.com/v1/image/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: `Album cover art for "${track_title}", mood: ${mood}, style: ${style}`,
        width: 1024,
        height: 1024,
        quality: qualityTier,
        format: 'png'
      })
    });

    if (!tempcolorResponse.ok) {
      const error = await tempcolorResponse.text();
      await base44.asServiceRole.entities.GenerationJob.update(job_id, {
        status: 'failed',
        error_message: `Tempcolor API error: ${error}`
      });
      return Response.json({ error: 'Failed to generate cover art' }, { status: 500 });
    }

    const result = await tempcolorResponse.json();

    const updated = await base44.asServiceRole.entities.GenerationJob.update(job_id, {
      status: 'completed',
      output_url: result.image_url,
      output_metadata: {
        tier,
        quality: qualityTier,
        mood,
        style
      },
      credits_used: credits,
      provider_job_id: result.id,
      completed_at: new Date().toISOString()
    });

    // Deduct credits on success
    const ded = await deductCreditsServerSide(base44, user, credits, {
      provider: 'tempcolor', job_id, description: `Cover art (${qualityTier})`,
    });

    return Response.json({
      job_id,
      status: 'completed',
      image_url: result.image_url,
      credits_used: credits,
      credits_remaining: ded.balance,
      tier: qualityTier
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});