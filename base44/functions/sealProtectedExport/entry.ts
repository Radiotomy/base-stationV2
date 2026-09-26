// Seals and (for opted-in creators) anchors a Protect & Register export — but
// ONLY once the BASE Mark V1 + V2 cascade has finalized.
//
//   1. Reads the finalized watermarked file (base_mark_v2.marked_file_url).
//   2. Builds the C2PA claim over THOSE bytes, with the raw export as parent
//      ingredient and the frozen session COS assertion, and signs it (ES256).
//   3. Stores c2pa_provenance_hash = SHA-256 of the signed manifest.
//   4. Anchors on Base mainnet with the watermarked file as the fingerprinted
//      audio, so the on-chain fingerprint and the c2pa hash both describe the
//      delivered file.
//
// Invoked by the "Seal Protected Export After Watermark" workflow. The body
// only names an asset; every gate is re-derived from the stored record, so a
// caller can never cause work the pipeline would not already do.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { signClaim, canonicalJson } from '../../shared/c2paSign.ts';
import { anchorAssetForOwner } from '../../shared/chainAnchor.ts';
import { assertSafeUrl } from '../../shared/safeUrl.ts';
import { routeAnchoredExport } from '../../shared/discoveryRouting.ts';

const hex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
const sha256 = async (data) => hex(await crypto.subtle.digest('SHA-256', data));
const STALE_SEALING_MS = 10 * 60 * 1000;

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const { assetId } = await req.json().catch(() => ({}));
    if (!assetId) return Response.json({ error: 'assetId required' }, { status: 400 });

    const asset = await svc.entities.UserAsset.get(assetId).catch(() => null);
    if (!asset) return Response.json({ error: 'Asset not found' }, { status: 404 });

    const seal = asset.metadata?.provenance_seal;
    const staleSealing = seal?.status === 'sealing'
      && Date.now() - new Date(seal.sealing_at || 0).getTime() > STALE_SEALING_MS;
    if (seal?.status !== 'awaiting_mark' && !staleSealing) {
      return Response.json({ skipped: true, reason: `Seal is ${seal?.status || 'absent'}` });
    }

    const v2 = asset.metadata?.base_mark_v2;
    if (v2?.status === 'failed') {
      // The cascade did not complete, so there is no delivered file to seal or
      // anchor. Recorded, never papered over with the raw export.
      await svc.entities.UserAsset.update(assetId, {
        chain_status: 'skipped',
        metadata: { ...asset.metadata, provenance_seal: { ...seal, status: 'blocked', error: v2.error || 'Watermark cascade failed' } },
      });
      return Response.json({ ok: false, status: 'blocked', error: v2.error });
    }
    if (v2?.status !== 'completed' || !v2.marked_file_url) {
      return Response.json({ skipped: true, reason: 'Watermark cascade not finalized yet' });
    }

    // Claim, then confirm we still hold it, before anything irreversible.
    const token = crypto.randomUUID();
    await svc.entities.UserAsset.update(assetId, {
      metadata: { ...asset.metadata, provenance_seal: { ...seal, status: 'sealing', sealing_at: new Date().toISOString(), sealing_token: token } },
    });
    const claimed = await svc.entities.UserAsset.get(assetId);
    if (claimed.metadata?.provenance_seal?.sealing_token !== token) {
      return Response.json({ skipped: true, reason: 'Another run is sealing this asset' });
    }

    // 1–2. Claim over the finalized watermarked audio.
    const finalUrl = v2.marked_file_url;
    const dl = await fetch(assertSafeUrl(finalUrl));
    if (!dl.ok) throw new Error(`Could not read the watermarked audio (${dl.status})`);
    const finalHash = await sha256(await dl.arrayBuffer());
    const sealedAt = new Date().toISOString();
    const v1Applied = !!claimed.metadata?.base_mark?.marked_file_url;

    const claim = {
      claim_generator: 'BASE Station Audiotool Bridge',
      title: seal.title || claimed.title,
      format: 'audio/wav',
      instance_id: `urn:sha256:${finalHash}`,
      sealed_at: sealedAt,
      assertions: [
        { label: 'c2pa.hash.data', data: { alg: 'sha256', hash: finalHash, scope: 'watermarked_master' } },
        { label: 'c2pa.ingredient', data: { relationship: 'parentOf', title: 'Raw Audiotool export', hash: { alg: 'sha256', value: seal.raw_export_sha256 } } },
        {
          label: 'c2pa.actions',
          data: {
            actions: [
              ...(seal.actions || []),
              { action: 'c2pa.watermarked', when: v2.embedded_at || sealedAt, softwareAgent: v1Applied ? 'BASE Mark V1 spread-spectrum + V2 neural' : 'BASE Mark V2 neural (V1 skipped: non-PCM source)' },
            ],
          },
        },
        { label: 'basestation.cos', data: { ...seal.cos, telemetry_event_ids: seal.telemetry_event_ids || [] } },
      ],
    };
    const manifest = await signClaim(claim);
    // Canonical form, so the hash is reproducible from the stored manifest.
    const manifestJson = canonicalJson(manifest);
    const c2paHash = await sha256(new TextEncoder().encode(manifestJson));
    const { file_uri: manifestUri } = await svc.integrations.Core.UploadPrivateFile({
      file: new File([manifestJson], `c2pa-${c2paHash.slice(0, 12)}.json`, { type: 'application/json' }),
    });

    // 3. Decide the anchor before writing, so the row never shows 'sealed' with no anchor decision.
    const owners = await svc.entities.User.filter({ id: claimed.user_id }).catch(() => []);
    const owner = owners?.[0];
    const optedIn = !!owner?.auto_anchor_provenance;

    const { sealing_token, ...sealRest } = claimed.metadata.provenance_seal;
    await svc.entities.UserAsset.update(assetId, {
      c2pa_provenance_hash: c2paHash,
      chain_status: optedIn ? 'pending' : 'skipped',
      metadata: {
        ...claimed.metadata,
        audio_sha256: finalHash,
        c2pa_manifest_uri: manifestUri,
        provenance_seal: {
          ...sealRest,
          status: 'sealed',
          sealed_at: sealedAt,
          final_audio_sha256: finalHash,
          manifest_status: manifest.status,
          manifest,
        },
      },
    });
    if (!optedIn) {
      return Response.json({ ok: true, status: 'sealed', c2pa_provenance_hash: c2paHash, anchored: false });
    }

    // 4. Anchor the watermarked file.
    const fresh = await svc.entities.UserAsset.get(assetId);
    const result = await anchorAssetForOwner(base44, fresh, owner, finalUrl);
    // Anchored → publish into BASE Station's own charts, playlists and radio.
    // Never fatal: the anchor is already permanent.
    const discovery = result.ok
      ? await routeAnchoredExport(svc, fresh, result).catch((e) => ({ routed: false, error: e.message }))
      : null;
    return Response.json({
      discovery,
      status: result.ok ? 'anchored' : 'anchor_failed',
      c2pa_provenance_hash: c2paHash,
      fingerprint_matches_watermarked_audio: result.fingerprint === finalHash,
      ...result,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}