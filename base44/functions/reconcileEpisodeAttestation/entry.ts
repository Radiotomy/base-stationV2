import { createClientFromRequest } from 'npm:@base44/sdk@0.8.43';
import { reconcileAttestation } from '../../shared/attestationReconcile.ts';

// Advisory attestation reconciliation for one episode.
//
// Reads only records BASE Station already owns and writes ONLY to
// Episode.advisory_review.reconciliation. It never touches ai_disclosure_label,
// ai_disclosure_basis, human_participation_score, the BASE Mark cascade or the
// on-chain anchor — a discrepancy is surfaced for a human, not acted on.
export default async function (req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const episodeId = String(body.episode_id || '');
  if (!episodeId) return Response.json({ error: 'Missing episode_id' }, { status: 400 });

  const episode = await base44.asServiceRole.entities.Episode.get(episodeId).catch(() => null);
  if (!episode) return Response.json({ error: 'Episode not found' }, { status: 404 });
  if (episode.user_id !== user.id && user.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [recordings, showVoiceovers, personas, allEpisodes] = await Promise.all([
    base44.asServiceRole.entities.Recording.filter({ episode_id: episodeId }).catch(() => []),
    base44.asServiceRole.entities.OrvoPodcastAsset
      .filter({ podcast_id: episode.podcast_id, asset_type: 'voiceover' }).catch(() => []),
    base44.asServiceRole.entities.VoicePersona.filter({ user_id: episode.user_id }).catch(() => []),
    base44.asServiceRole.entities.Episode.filter({ user_id: episode.user_id }).catch(() => []),
  ]);

  const reconciliation = reconcileAttestation({
    episode,
    recordings: recordings || [],
    showVoiceovers: showVoiceovers || [],
    personas: personas || [],
    priorEpisodes: (allEpisodes || []).filter((e) => e.id !== episodeId),
  });

  // Merge so the third-party sub-report is never clobbered
  const updated = await base44.asServiceRole.entities.Episode.update(episodeId, {
    advisory_review: { ...(episode.advisory_review || {}), reconciliation },
  });

  return Response.json({ ok: true, reconciliation, episode: updated });
}