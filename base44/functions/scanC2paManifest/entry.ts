import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertSafeUrl } from '../../shared/safeUrl.ts';
import { scanC2paFromUrl } from '../../shared/c2paProvenance.ts';

// Tier 2 — read any C2PA / Content Credentials manifest attached to an
// episode's audio. Read-only: writes to Episode.c2pa_provenance and nothing
// else. Disclosure label, COS score and the on-chain anchor are untouched.
export default async function (req) {
  try {
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

    const source = episode.storage_audio_url || episode.audio_url;
    if (!source) return Response.json({ error: 'Episode has no audio to scan' }, { status: 400 });

    const scan = await scanC2paFromUrl(assertSafeUrl(source));

    const updated = await base44.asServiceRole.entities.Episode.update(episodeId, {
      c2pa_provenance: scan,
    });

    return Response.json({ ok: true, c2pa: scan, episode: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}