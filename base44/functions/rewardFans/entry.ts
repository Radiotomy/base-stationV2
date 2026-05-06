import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Phase 5 — Reward top fans of a creator.
 *
 * Payload: {
 *   criteria: "top_reactors" | "top_chatters" | "top_tippers" | "longest_watch",
 *   limit?: number = 5,
 *   reward: { type: "xp" | "badge" | "collectible", amount?: number, badge_name?: string, collectible_id?: string },
 *   since_days?: number = 30
 * }
 */
const CRITERIA_TO_ACTION = {
  top_reactors: 'reaction',
  top_chatters: 'chat',
  top_tippers: 'tip',
  longest_watch: 'watch_time',
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { criteria, limit = 5, reward, since_days = 30 } = await req.json();
    const action_type = CRITERIA_TO_ACTION[criteria];
    if (!action_type) return Response.json({ error: 'invalid criteria' }, { status: 400 });
    if (!reward?.type) return Response.json({ error: 'reward required' }, { status: 400 });

    const since = new Date(Date.now() - since_days * 24 * 60 * 60 * 1000).toISOString();
    const actions = await base44.asServiceRole.entities.FanAction.filter({
      creator_id: user.id, action_type,
    }, '-created_date', 1000);

    // Aggregate
    const tally = new Map();
    for (const a of actions) {
      if (a.created_date && a.created_date < since) continue;
      const score = action_type === 'tip' || action_type === 'watch_time'
        ? (a.value || 1) : 1;
      const cur = tally.get(a.user_id) || { user_id: a.user_id, user_name: a.user_name, score: 0 };
      cur.score += score;
      tally.set(a.user_id, cur);
    }
    const top = [...tally.values()].sort((a, b) => b.score - a.score).slice(0, limit);

    const rewarded = [];
    for (const fan of top) {
      try {
        if (reward.type === 'xp') {
          const amount = Number(reward.amount || 25);
          const xpRows = await base44.asServiceRole.entities.UserXP.filter({ user_id: fan.user_id });
          if (xpRows[0]) {
            await base44.asServiceRole.entities.UserXP.update(xpRows[0].id, {
              total_xp: (xpRows[0].total_xp || 0) + amount,
              weekly_xp: (xpRows[0].weekly_xp || 0) + amount,
              monthly_xp: (xpRows[0].monthly_xp || 0) + amount,
            });
          } else {
            await base44.asServiceRole.entities.UserXP.create({
              user_id: fan.user_id, user_name: fan.user_name,
              total_xp: amount, weekly_xp: amount, monthly_xp: amount,
            });
          }
        } else if (reward.type === 'badge' && reward.badge_name) {
          const ex = await base44.asServiceRole.entities.UserBadge.filter({
            user_id: fan.user_id, badge_name: reward.badge_name,
          }).catch(() => []);
          if (ex.length === 0) {
            await base44.asServiceRole.entities.UserBadge.create({
              user_id: fan.user_id, user_name: fan.user_name,
              badge_name: reward.badge_name,
              description: `Awarded by ${user.full_name} for ${criteria}`,
              earned_at: new Date().toISOString(),
            });
          }
        } else if (reward.type === 'collectible' && reward.collectible_id) {
          const exC = await base44.asServiceRole.entities.CollectibleClaim.filter({
            collectible_id: reward.collectible_id, user_id: fan.user_id,
          });
          if (exC.length === 0) {
            const cArr = await base44.asServiceRole.entities.Collectible.filter({ id: reward.collectible_id });
            const coll = cArr[0];
            if (coll && coll.origin !== 'loudly') {
              const serial = (coll.claimed_count || 0) + 1;
              await base44.asServiceRole.entities.CollectibleClaim.create({
                collectible_id: reward.collectible_id,
                creator_id: user.id,
                user_id: fan.user_id,
                user_name: fan.user_name,
                claim_source: 'reward',
                serial_number: serial,
                claimed_at: new Date().toISOString(),
              });
              await base44.asServiceRole.entities.Collectible.update(reward.collectible_id, {
                claimed_count: serial,
              }).catch(() => {});
            }
          }
        }
        rewarded.push(fan);
      } catch { /* skip individual failures */ }
    }

    return Response.json({ ok: true, rewarded, criteria, reward });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});