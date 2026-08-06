import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * Phase 4 — Evaluate a fan's progress on a LiveQuest and award XP/badges
 * when the target is genuinely reached.
 *
 * Payload: { questId }
 *
 * SECURITY: progress is DERIVED, never incremented. This endpoint used to add
 * +1 per call, which meant the call itself was the only evidence a quest had
 * been worked on — any authenticated user could complete any active quest by
 * hitting it in a loop and collect the XP and badge. Progress is now recounted
 * from the records the quest actually describes (chat messages, reactions,
 * completed tips, elapsed time), all of which are written by the real fan
 * actions elsewhere in the app. Calling this endpoint repeatedly now changes
 * nothing: it just re-reads the same evidence.
 */

// Only look back over a bounded window of a fan's own session records.
const EVIDENCE_LIMIT = 500;

function isReaction(m) {
  return m.messageType === 'reaction' || m.type === 'reaction';
}

/**
 * Count what the fan has actually done for this quest, from stored records
 * created after the quest went live.
 */
async function measureProgress(base44, quest, user) {
  const since = new Date(quest.created_date).getTime();
  const after = (row) => new Date(row.created_date).getTime() >= since;

  if (quest.quest_type === 'stay_duration') {
    // Wall-clock seconds since the quest opened. Cannot be inflated by calling
    // more often — the clock is the server's.
    return Math.max(0, Math.floor((Date.now() - since) / 1000));
  }

  if (quest.quest_type === 'tip') {
    if (!quest.performer_id) return 0;
    const tips = await base44.asServiceRole.entities.Tip.filter({
      from_user_id: user.id,
      to_artist_id: quest.performer_id,
      status: 'completed',
    }, '-created_date', EVIDENCE_LIMIT);
    return tips.filter(after).reduce((sum, t) => sum + (t.amount_cents || 0), 0);
  }

  // reaction | chat — both live on LiveChatMessage, distinguished by type.
  const msgs = await base44.asServiceRole.entities.LiveChatMessage.filter({
    session_id: quest.session_id,
    user_id: user.id,
  }, '-created_date', EVIDENCE_LIMIT);

  const recent = msgs.filter(after);
  return quest.quest_type === 'reaction'
    ? recent.filter(isReaction).length
    : recent.filter((m) => !isReaction(m)).length;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { questId } = await req.json();
    if (!questId) return Response.json({ error: 'questId required' }, { status: 400 });

    const arr = await base44.asServiceRole.entities.LiveQuest.filter({ id: questId });
    const quest = arr[0];
    if (!quest) return Response.json({ error: 'Quest not found' }, { status: 404 });
    if (quest.status !== 'active') return Response.json({ ok: false, reason: 'inactive' });

    const progress = quest.progress || {};
    const completers = quest.completers || [];
    if (completers.includes(user.id)) {
      return Response.json({ ok: true, completed: true, already: true });
    }

    const current = await measureProgress(base44, quest, user);
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

    await base44.asServiceRole.entities.LiveQuest.update(questId, { progress, completers });

    return Response.json({ ok: true, completed, current, target: quest.target, newBadges });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});