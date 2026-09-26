import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

// Exact platform totals for the admin overview. Counts page through every
// matching row instead of sampling, so the numbers are true totals.
const PAGE = 5000;

async function countAll(entity, query = {}) {
  let total = 0;
  for (let skip = 0; ; skip += PAGE) {
    const rows = await entity.filter(query, '-created_date', PAGE, skip);
    total += rows.length;
    if (rows.length < PAGE) return total;
  }
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const e = base44.asServiceRole.entities;
    const [totalTracks, pendingTracks, approvedTracks, totalArtists, activeChallenges, pendingApps, solanaRegistrations, openReports] =
      await Promise.all([
        countAll(e.TrackSubmission),
        countAll(e.TrackSubmission, { status: 'pending' }),
        countAll(e.TrackSubmission, { status: 'approved' }),
        countAll(e.ArtistProfile),
        countAll(e.Challenge, { status: 'active' }),
        countAll(e.FeaturedArtistApplication, { status: 'pending' }),
        countAll(e.SolanaTrackRegistry),
        countAll(e.OrvoReport, { status: 'open' }),
      ]);

    return Response.json({
      totalTracks, pendingTracks, approvedTracks, totalArtists,
      activeChallenges, pendingApps, solanaRegistrations, openReports,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}