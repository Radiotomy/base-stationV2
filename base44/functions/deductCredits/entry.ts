import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { amount, job_id, provider, description } = await req.json();
    if (!amount) return Response.json({ error: 'Missing amount' }, { status: 400 });

    // Get or create user credit record
    let credits = await base44.asServiceRole.entities.UserCredit.filter({ user_id: user.id });
    let creditRecord = credits.length > 0 ? credits[0] : null;

    if (!creditRecord) {
      creditRecord = await base44.asServiceRole.entities.UserCredit.create({
        user_id: user.id,
        user_email: user.email,
        balance: 0,
        lifetime_earned: 0,
        lifetime_spent: 0
      });
    }

    const newBalance = creditRecord.balance - amount;
    if (newBalance < 0) return Response.json({ error: 'Insufficient credits' }, { status: 400 });

    // Update credit balance
    await base44.asServiceRole.entities.UserCredit.update(creditRecord.id, {
      balance: newBalance,
      lifetime_spent: (creditRecord.lifetime_spent || 0) + amount,
      monthly_used: (creditRecord.monthly_used || 0) + amount
    });

    // Log transaction
    await base44.asServiceRole.entities.CreditLog.create({
      user_id: user.id,
      user_email: user.email,
      transaction_type: 'generation',
      amount: -amount,
      balance_before: creditRecord.balance,
      balance_after: newBalance,
      related_job_id: job_id,
      provider,
      description
    });

    return Response.json({ balance: newBalance, transaction_id: creditRecord.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});