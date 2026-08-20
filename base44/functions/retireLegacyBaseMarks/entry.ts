import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// PHASE 3 — legacy format retirement.
//
// WHY THIS EXISTS
// Phase 1 keyed the V2 validity tag; Phase 2 required a legacy hit to be
// corroborated by a legacy-marked asset. Both are containments, not cures: while
// ANY asset is still registered under the pre-Phase-1 format, the legacy read
// path must stay open in unpackMessage, and that path accepts a message anyone
// can construct from public information (unkeyed FNV payload + the published
// 0xB5 magic). The only way to close it is to have nothing left to read.
//
// WHY PURGE AND NOT RE-MARK
// Re-marking would re-embed audio and spend GPU per asset. These assets are
// platform-internal test material, none of it distributed, so preserving their
// recoverable identity buys nothing — whereas leaving them registered keeps a
// forgery path open. Purging the legacy mark RECORD is therefore the correct
// trade here, and it is the honest outcome too: the audio still physically
// carries a legacy watermark, and after this runs that watermark resolves to no
// registered work, which is exactly what an unregistered mark should do.
//
// Anything that genuinely needs a mark afterwards gets a keyed one for free via
// the existing autoBaseMarkV2 / backfillBaseMarkV2 machinery.
//
// A legacy layer is one carrying a payload but NO payload_version stamp —
// absence means legacy, per registeredPayloadVersions().

const LAYER_KEYS = ['base_mark', 'base_mark_v2', 'base_mark_v4'];

function legacyLayers(asset) {
  const out = [];
  for (const key of LAYER_KEYS) {
    const layer = asset?.metadata?.[key];
    if (layer && layer.payload_hex && !layer.payload_version) {
      out.push({ layer: key, payload_hex: layer.payload_hex });
    }
  }
  return out;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    // Destructive and irreversible, so it does NOT run unless asked explicitly.
    const dryRun = body.dry_run !== false;

    // Full catalogue sweep — a partial page would leave legacy rows behind and
    // the whole point is reaching zero.
    const assets = [];
    const pageSize = 200;
    for (let page = 0; page < 50; page++) {
      const rows = await base44.asServiceRole.entities.UserAsset.list('-created_date', pageSize, page * pageSize);
      if (!rows?.length) break;
      assets.push(...rows);
      if (rows.length < pageSize) break;
    }

    const targets = [];
    for (const a of assets) {
      const layers = legacyLayers(a);
      if (layers.length) targets.push({ asset: a, layers });
    }

    if (dryRun) {
      return Response.json({
        dry_run: true,
        scanned: assets.length,
        legacy_assets: targets.length,
        legacy_layer_counts: targets.reduce((acc, t) => {
          for (const l of t.layers) acc[l.layer] = (acc[l.layer] || 0) + 1;
          return acc;
        }, {}),
        sample: targets.slice(0, 10).map((t) => ({
          id: t.asset.id,
          title: t.asset.title,
          layers: t.layers.map((l) => `${l.layer}:${l.payload_hex}`),
        })),
        note: 'Re-send with dry_run:false to retire these records. Irreversible.',
      });
    }

    const retired = [];
    const failed = [];
    for (const { asset, layers } of targets) {
      try {
        // Re-read so a concurrent write (persistExternalMedia, a V2 finalize)
        // is not clobbered by a stale metadata object.
        const fresh = await base44.asServiceRole.entities.UserAsset.get(asset.id);
        const meta = { ...(fresh?.metadata || {}) };
        const removed = [];
        for (const { layer } of layers) {
          if (meta[layer] && meta[layer].payload_hex && !meta[layer].payload_version) {
            removed.push({ layer, payload_hex: meta[layer].payload_hex });
            delete meta[layer];
          }
        }
        if (!removed.length) continue;
        // Audit trail: the row remembers it once held a legacy mark. This key is
        // NOT one of the resolver's layer indexes, so it carries no attribution
        // power — it exists so a later "why does this file not resolve?" has an
        // answer instead of looking like data loss.
        meta.base_mark_legacy_retired = {
          retired_at: new Date().toISOString(),
          retired_by: user.id,
          layers: removed,
          reason: 'Phase 3 legacy format retirement — pre-Phase-1 unkeyed payload',
        };
        await base44.asServiceRole.entities.UserAsset.update(asset.id, { metadata: meta });
        retired.push({ id: asset.id, title: asset.title, layers: removed.map((r) => r.layer) });
      } catch (e) {
        failed.push({ id: asset.id, error: e.message });
      }
    }

    return Response.json({
      dry_run: false,
      scanned: assets.length,
      retired_count: retired.length,
      failed_count: failed.length,
      retired,
      failed,
      legacy_rows_remaining: targets.length - retired.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});