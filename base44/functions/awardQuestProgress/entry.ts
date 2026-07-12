import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Phase 4 — Track fan progress on a LiveQuest and award XP/badges
 * when target is reached.
 *
 * Payload: { questId }
 * Progress always advances by exactly 1 per call — the client cannot
 * supply an increment amount (prevents quest/reward spoofing).
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { questId } = await req.json();
    if (!questId) return Response.json({ error: 'questId required' }, { status: 400 });
    const increment = 1; // fixed server-side — never trust client-supplied amounts

    const arr = await base44.asServiceRole.entities.LiveQuest.filter({ id: questId });
    const quest = arr[0];
    if (!quest) return Response.json({ error: 'Quest not found' }, { status: 404 });
    if (quest.status !== 'active') return Response.json({ ok: false, reason: 'inactive' });

    const progress = quest.progress || {};
    const completers = quest.completers || [];
    if (completers.includes(user.id)) {
      return Response.json({ ok: true, completed: true, already: true });
    }

    const current = (progress[user.id] || 0) + increment;
    progress[user.id] = current;

    let completed = false;
    let newBadges = [];
    if (current >= quest.target) {
      completed = true;
      completers.push(user.id);

      // Award XP
      try {
        const xpRows = await base44.asServiceRole.entities.UserXP.filter({ user_id: user.id });
        const xpRow = xpRows[0];
        if (xpRow) {
          await base44.asServiceRole.entities.UserXP.update(xpRow.id, {
            total_xp: (xpRow.total_xp || 0) + (quest.reward_xp || 0),
            weekly_xp: (xpRow.weekly_xp || 0) + (quest.reward_xp || 0),
            monthly_xp: (xpRow.monthly_xp || 0) + (quest.reward_xp || 0),
          });
        } else {
          await base44.asServiceRole.entities.UserXP.create({
            user_id: user.id,
            user_email: user.email,
            user_name: user.full_name,
            total_xp: quest.reward_xp || 0,
            weekly_xp: quest.reward_xp || 0,
            monthly_xp: quest.reward_xp || 0,
          });
        }
      } catch { /* non-blocking */ }

      // Award badge
      if (quest.reward_badge) {
        try {
          const existing = await base44.asServiceRole.entities.UserBadge.filter({
            user_id: user.id, badge_slug: quest.reward_badge,
          });
          if (existing.length === 0) {
            await base44.asServiceRole.entities.UserBadge.create({
              user_id: user.id,
              user_email: user.email,
              badge_slug: quest.reward_badge,
              awarded_at: new Date().toISOString(),
            });
            newBadges.push(quest.reward_badge);
          }
        } catch { /* non-blocking */ }
      }
    }

    await base44.asServiceRole.entities.LiveQuest.update(questId, {
      progress,
      completers,
      ...(completed && completers.length >= 1 ? {} : {}),
    });

    return Response.json({ ok: true, completed, current, target: quest.target, newBadges });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});