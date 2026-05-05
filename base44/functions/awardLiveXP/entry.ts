import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SESSION_CAP = 20;
const XP_FOR = { reaction: 2, chat: 1, attend: 5 };

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { sessionId, kind } = await req.json();
    if (!sessionId || !kind || !XP_FOR[kind]) {
      return Response.json({ error: 'sessionId and valid kind required' }, { status: 400 });
    }

    // Find or create UserXP
    const existing = await base44.asServiceRole.entities.UserXP.filter({ user_id: user.id });
    let xpRecord = existing[0];
    if (!xpRecord) {
      xpRecord = await base44.asServiceRole.entities.UserXP.create({
        user_id: user.id,
        user_email: user.email,
        user_name: user.full_name,
        total_xp: 0,
        level: 1,
        weekly_xp: 0,
        monthly_xp: 0,
      });
    }

    // Track per-session XP via AnalyticsEvent (event_data.session_xp_kind)
    const sessionXpEvents = await base44.asServiceRole.entities.AnalyticsEvent.filter({
      user_id: user.id,
      session_id: sessionId,
      event_type: 'live_reaction',
    });
    const earnedThisSession = sessionXpEvents.reduce((sum, e) => sum + (e.event_data?.xp_awarded || 0), 0);

    let xpToAward = XP_FOR[kind];
    if (earnedThisSession + xpToAward > SESSION_CAP) {
      xpToAward = Math.max(0, SESSION_CAP - earnedThisSession);
    }
    if (xpToAward === 0) {
      return Response.json({ awarded: 0, capped: true, total_xp: xpRecord.total_xp });
    }

    const newTotal = (xpRecord.total_xp || 0) + xpToAward;
    const newLevel = Math.floor(newTotal / 100) + 1;

    await base44.asServiceRole.entities.UserXP.update(xpRecord.id, {
      total_xp: newTotal,
      weekly_xp: (xpRecord.weekly_xp || 0) + xpToAward,
      monthly_xp: (xpRecord.monthly_xp || 0) + xpToAward,
      level: newLevel,
    });

    // Auto-award badges
    const newBadges = [];
    const badgeThresholds = [
      { name: 'live_attendee', xp: 5, description: 'Attended your first live session' },
      { name: 'super_reactor', xp: 50, description: 'Reacted 25+ times across live sessions' },
      { name: 'live_supporter', xp: 200, description: 'Earned 200+ live XP' },
    ];
    for (const b of badgeThresholds) {
      if (newTotal >= b.xp && (xpRecord.total_xp || 0) < b.xp) {
        const existingBadge = await base44.asServiceRole.entities.UserBadge.filter({ user_id: user.id, badge_name: b.name }).catch(() => []);
        if (existingBadge.length === 0) {
          await base44.asServiceRole.entities.UserBadge.create({
            user_id: user.id,
            user_name: user.full_name,
            user_email: user.email,
            badge_name: b.name,
            description: b.description,
            earned_at: new Date().toISOString(),
          }).catch(() => {});
          newBadges.push(b.name);
        }
      }
    }

    return Response.json({
      awarded: xpToAward,
      total_xp: newTotal,
      level: newLevel,
      session_total: earnedThisSession + xpToAward,
      session_cap: SESSION_CAP,
      new_badges: newBadges,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});