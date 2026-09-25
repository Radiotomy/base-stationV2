import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { deriveDimensions, COS_ENGINE_VERSION } from '../../shared/cosEngine.ts';
import { verifySignedManifest, canonicalJson } from '../../shared/c2paSign.ts';

// Signed Content Credentials, re-verified on every read. The hash check proves
// this is the manifest the anchor names; the signature check proves the claim
// (including the embedded COS) is unaltered since sealing.
async function c2paSummary(asset) {
  const seal = asset.metadata?.provenance_seal;
  if (!seal) return null;
  if (!seal.manifest) return { status: seal.status, signed: false };
  const bytes = new TextEncoder().encode(canonicalJson(seal.manifest));
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
    .map((b) => b.toString(16).padStart(2, '0')).join('');
  const cos = seal.manifest.claim?.assertions?.find((a) => a.label === 'basestation.cos')?.data;
  return {
    status: seal.manifest.status_label,
    signed: true,
    trust: seal.manifest.trust,
    signer: seal.manifest.signer,
    alg: seal.manifest.signature?.alg,
    signature_valid: await verifySignedManifest(seal.manifest),
    hash_matches: hash === asset.c2pa_provenance_hash,
    audio_sha256: seal.final_audio_sha256,
    sealed_at: seal.sealed_at,
    cos: cos ? { score: cos.score, label: cos.label, human_share: cos.contribution?.humanShare ?? null, ai_invocations: cos.ai_invocations } : null,
  };
}

/**
 * COS Public Verification Ledger — partner/B2B endpoint.
 * GET  ?assetId=...   or   POST { assetId }
 * Returns the asset's Creative Ownership Score, disclosure label,
 * signal breakdown and DDEX AI attribution profile as JSON.
 * Access: public assets → any authenticated caller (incl. partner API keys);
 * private assets → owner or admin only.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let assetId = new URL(req.url).searchParams.get('assetId');
    if (!assetId && req.method !== 'GET') {
      const body = await req.json().catch(() => ({}));
      assetId = body?.assetId;
    }
    if (!assetId) return Response.json({ error: 'assetId required (query param or JSON body)' }, { status: 400 });

    const rows = await base44.asServiceRole.entities.UserAsset.filter({ id: assetId });
    const asset = rows[0];
    if (!asset) return Response.json({ error: 'Asset not found' }, { status: 404 });

    if (!asset.is_public && asset.user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'This asset is not public' }, { status: 403 });
    }

    const s = asset.participation_signals || {};
    const score = asset.human_participation_score ?? 0;
    const ddex = (asset.ddex_ai_metadata && Object.keys(asset.ddex_ai_metadata).length > 0)
      ? asset.ddex_ai_metadata
      : {
          ai_lyrical_content: !s.user_content,
          ai_composition: score < 50,
          ai_instrumentation: !s.reference_material,
          ai_generated_vocals: !!s.persona_used,
          ai_post_production: asset.asset_type === 'master',
        };

    return Response.json({
      manifest_version: '2.0',
      cos_engine: COS_ENGINE_VERSION,
      asset_id: asset.id,
      title: asset.title || 'Untitled',
      asset_type: asset.asset_type,
      created_date: asset.created_date,
      is_public: !!asset.is_public,
      human_participation_score: score,
      ai_disclosure_label: asset.ai_disclosure_label || asset.ai_label || 'ai_generated',
      ai_disclosure_basis: asset.ai_disclosure_basis || null,
      // Signal PRESENCE only — per-signal point values are engine-internal
      // and are never exposed through partner endpoints.
      participation_signals: Object.fromEntries(Object.keys(s).map((k) => [k, true])),
      dimensions: Object.fromEntries(
        Object.entries(deriveDimensions(s)).map(([dim, d]) => [dim, { label: d.label, pct: d.pct }])
      ),
      ddex_ai_metadata: ddex,
      c2pa_provenance_hash: asset.c2pa_provenance_hash || null,
      c2pa_manifest: await c2paSummary(asset),
      base_mark: asset.metadata?.base_mark ? {
        version: asset.metadata.base_mark.version || '1.0',
        payload_hex: asset.metadata.base_mark.payload_hex,
        embedded_at: asset.metadata.base_mark.embedded_at || null,
      } : null,
      labeling_standard: 'RIAA/IFPI voluntary GenAI labeling program (July 2026)',
      issued_at: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});