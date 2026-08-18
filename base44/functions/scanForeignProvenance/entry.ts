import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertSafeUrl } from '../../shared/safeUrl.ts';
import { scanForeignProvenanceFromUrl } from '../../shared/foreignProvenance.ts';

// Tier 1 foreign-provenance scan for an outside upload.
//
// Reads what the source tool declared in the container (workstation name,
// encoder software, coding history) so an episode with no in-app telemetry can
// say something true instead of nothing. Findings NEVER override the creator's
// attestation — they are recorded alongside it.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const episodeId = String(body.episode_id || '');
    let audioUrl = String(body.audio_url || '');
    let episode = null;

    if (episodeId) {
      episode = await base44.asServiceRole.entities.Episode.get(episodeId).catch(() => null);
      if (!episode) return Response.json({ error: 'Episode not found' }, { status: 404 });
      if (episode.user_id !== user.id && user.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      audioUrl = episode.storage_audio_url || episode.audio_url || '';
    }
    if (!audioUrl) return Response.json({ error: 'No audio to scan' }, { status: 400 });

    const safeUrl = assertSafeUrl(audioUrl);
    const result = await scanForeignProvenanceFromUrl(safeUrl);

    if (episode) {
      const updated = await base44.asServiceRole.entities.Episode.update(episodeId, {
        external_provenance: result,
      });
      return Response.json({ ok: true, external_provenance: result, episode: updated });
    }

    return Response.json({ ok: true, external_provenance: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}