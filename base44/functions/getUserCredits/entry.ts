import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Get or create user credit record
    let credits = await base44.entities.UserCredit.filter({ user_id: user.id });
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

    return Response.json({
      balance: creditRecord.balance,
      lifetime_earned: creditRecord.lifetime_earned,
      lifetime_spent: creditRecord.lifetime_spent,
      monthly_limit: creditRecord.monthly_limit,
      monthly_used: creditRecord.monthly_used,
      is_premium: creditRecord.is_premium
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});