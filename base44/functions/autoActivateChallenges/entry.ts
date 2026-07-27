import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Scheduled daily — moves challenges through their lifecycle automatically:
//   upcoming -> active   (once start_date has arrived)
//   active   -> voting   (once end_date has passed)
//   voting   -> completed (3 days after end_date)
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const challenges = await base44.asServiceRole.entities.Challenge.list('-created_date', 200);
    const now = Date.now();
    const updates = [];

    for (const c of challenges) {
      const start = c.start_date ? new Date(c.start_date).getTime() : null;
      const end = c.end_date ? new Date(c.end_date).getTime() : null;

      if (c.status === 'upcoming' && start && now >= start) {
        updates.push({ id: c.id, status: 'active' });
      } else if (c.status === 'active' && end && now >= end) {
        updates.push({ id: c.id, status: 'voting' });
      } else if (c.status === 'voting' && end && now >= end + 3 * 24 * 60 * 60 * 1000) {
        updates.push({ id: c.id, status: 'completed' });
      }
    }

    for (const u of updates) {
      await base44.asServiceRole.entities.Challenge.update(u.id, { status: u.status });
    }

    return Response.json({ updated: updates.length, updates });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}