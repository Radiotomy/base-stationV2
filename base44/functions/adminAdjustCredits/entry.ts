import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Admin-only: adjust a user's credit balance.
 * Payload: {
 *   target_user_id: string,        // user.id of the account to modify
 *   action: 'grant' | 'deduct' | 'set',
 *   amount: number,                // for grant/deduct: delta; for set: new absolute balance
 *   reason?: string,               // free-text reason logged on CreditLog
 *   is_premium?: boolean,          // optional flag override
 * }
 * Returns: { ok, balance, lifetime_earned, lifetime_spent }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });

    const { target_user_id, action, amount, reason, is_premium } = await req.json();
    if (!target_user_id) return Response.json({ error: 'target_user_id required' }, { status: 400 });
    if (!['grant', 'deduct', 'set'].includes(action)) return Response.json({ error: 'Invalid action' }, { status: 400 });
    const delta = Number(amount);
    if (!Number.isFinite(delta) || delta < 0) return Response.json({ error: 'amount must be a non-negative number' }, { status: 400 });

    // Resolve target user
    const targets = await base44.asServiceRole.entities.User.filter({ id: target_user_id });
    const target = targets[0];
    if (!target) return Response.json({ error: 'Target user not found' }, { status: 404 });

    // Get or create the credit record
    let credits = await base44.asServiceRole.entities.UserCredit.filter({ user_id: target_user_id });
    let record = credits[0];
    if (!record) {
      record = await base44.asServiceRole.entities.UserCredit.create({
        user_id: target_user_id,
        user_email: target.email,
        balance: 0, lifetime_earned: 0, lifetime_spent: 0,
        monthly_limit: 1000, monthly_used: 0, is_premium: false,
      });
    }

    const before = record.balance || 0;
    let after = before;
    let earnedDelta = 0;
    let spentDelta = 0;

    if (action === 'grant') { after = before + delta; earnedDelta = delta; }
    else if (action === 'deduct') { after = Math.max(0, before - delta); spentDelta = before - after; }
    else if (action === 'set') {
      after = delta;
      const diff = after - before;
      if (diff > 0) earnedDelta = diff; else if (diff < 0) spentDelta = -diff;
    }

    const updatePayload = {
      balance: after,
      lifetime_earned: (record.lifetime_earned || 0) + earnedDelta,
      lifetime_spent: (record.lifetime_spent || 0) + spentDelta,
    };
    if (typeof is_premium === 'boolean') updatePayload.is_premium = is_premium;
    await base44.asServiceRole.entities.UserCredit.update(record.id, updatePayload);

    // Audit log
    await base44.asServiceRole.entities.CreditLog.create({
      user_id: target_user_id,
      user_email: target.email,
      transaction_type: action === 'deduct' ? 'admin_deduct' : 'admin_grant',
      amount: after - before,
      balance_before: before,
      balance_after: after,
      description: `Admin ${action} by ${user.email}${reason ? ` — ${reason}` : ''}`,
      metadata: { admin_id: user.id, admin_email: user.email, action, reason: reason || null },
    }).catch(() => {});

    return Response.json({
      ok: true,
      balance: after,
      balance_before: before,
      lifetime_earned: updatePayload.lifetime_earned,
      lifetime_spent: updatePayload.lifetime_spent,
      is_premium: typeof is_premium === 'boolean' ? is_premium : record.is_premium,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});