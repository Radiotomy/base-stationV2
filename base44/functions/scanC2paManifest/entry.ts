import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertSafeUrl } from '../../shared/safeUrl.ts';
import { scanC2paFromUrl, SOURCE_ORIGINAL, SOURCE_POST_BASEMARK } from '../../shared/c2paProvenance.ts';

// Tier 2 — read any C2PA / Content Credentials manifest attached to an
// episode's audio. Read-only: writes to Episode.c2pa_provenance and nothing
// else. Disclosure label, COS score and the on-chain anchor are untouched.
//
// Tier 2 is a statement about the ORIGINAL upload. BASE Mark embeds into the
// audio after this read, so once an episode is marked, any re-scan can only
// describe our own pipeline's output. Two rules keep that from quietly
// corrupting the record:
//   1. Every scan records which copy it saw (source_state).
//   2. A pristine (pre-mark) scan is never overwritten by a post-mark one.
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

    // Marked audio is no longer the file the creator handed us.
    const sourceState = episode.base_mark_asset_id ? SOURCE_POST_BASEMARK : SOURCE_ORIGINAL;

    const existing = episode.c2pa_provenance;
    if (existing?.source_state === SOURCE_ORIGINAL && sourceState === SOURCE_POST_BASEMARK) {
      return Response.json({
        ok: true,
        preserved: true,
        c2pa: existing,
        note: 'Kept the existing scan of the original upload. This episode has since been BASE Marked, so a re-scan would read this platform\'s output rather than the source file.',
      });
    }

    const scan = await scanC2paFromUrl(assertSafeUrl(source), sourceState);
    scan.scanned_source = source;

    const updated = await base44.asServiceRole.entities.Episode.update(episodeId, {
      c2pa_provenance: scan,
    });

    return Response.json({ ok: true, c2pa: scan, episode: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}