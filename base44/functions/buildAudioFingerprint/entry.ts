import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { extractPrintFromUrl, storePrint } from '../../shared/printRegistry.ts';

// Build and store the BASE Print reference for one registered asset.
//
// A Print is a REFERENCE, not a mark: nothing is written into the audio, so this
// is safe to run on already-marked files and cannot disturb the BASE Mark
// cascade. It reads the asset's audio and stores a packed ratio-hash blob.
//
// Two call shapes:
//   { asset_id }                     — print a UserAsset directly
//   { episode_id }                   — print an ORVO episode via its
//                                      base_mark_asset_id, so the print lands on
//                                      the same asset row the cascade uses
//
// Coverage limit, stated rather than hidden: server-side MP3 decoding is not
// available in this runtime, so an MP3-only source returns reason
// 'non_pcm_source'. That is a gap in what we can READ, not a finding about the
// audio, and callers must not present it as "no fingerprint possible".
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const episodeId = String(body.episode_id || '');
    let assetId = String(body.asset_id || '');
    let episode = null;

    if (episodeId) {
      episode = await base44.asServiceRole.entities.Episode.get(episodeId).catch(() => null);
      if (!episode) return Response.json({ error: 'Episode not found' }, { status: 404 });
      if (episode.user_id !== user.id && user.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (!episode.base_mark_asset_id) {
        return Response.json({ error: 'Episode is not registered yet — register provenance first' }, { status: 400 });
      }
      assetId = episode.base_mark_asset_id;
    }

    if (!assetId) return Response.json({ error: 'Provide asset_id or episode_id' }, { status: 400 });

    const asset = await base44.asServiceRole.entities.UserAsset.get(assetId).catch(() => null);
    if (!asset) return Response.json({ error: 'Asset not found' }, { status: 404 });
    if (asset.user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Prefer a PCM copy when one exists. The marked V1 file is PCM WAV by
    // construction, which makes it the most reliable print source available.
    const source = asset.metadata?.base_mark?.marked_file_url
      || asset.metadata?.wav_url
      || asset.file_url;
    if (!source) return Response.json({ error: 'Asset has no audio URL' }, { status: 400 });

    const extract = await extractPrintFromUrl(source);
    if (!extract.ok) {
      return Response.json({ ok: false, reason: extract.reason, detail: extract.detail || null });
    }

    const row = await storePrint(base44, {
      asset_id: assetId,
      episode_id: episodeId,
      user_id: asset.user_id,
      title: episode?.title || asset.title,
      source_url: source,
      // Declared from where the audio came from, never inferred from the
      // waveform — the same discipline the origin attestation follows. Keeping
      // speech and music populations separate is what allows a speech-specific
      // false-positive rate to be measured at all.
      content_class: episodeId ? 'speech' : 'music',
    }, extract);

    return Response.json({
      ok: true,
      fingerprint_id: row.id,
      asset_id: assetId,
      hash_count: extract.hash_count,
      duration_bracket: extract.duration_bracket,
      hashes_per_second: extract.hashes_per_second,
      duration_seconds: Math.round(extract.duration_seconds),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}