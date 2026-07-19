// Persist external media into Base44 storage so generated/submitted content
// never disappears when provider CDN links expire.
//
// Two invocation modes:
//  1. Entity automation (TrackSubmission / UserAsset create) — payload carries
//     { event: { entity_name, entity_id } }. Persists that single record.
//     Safe without a user: URLs are always read from the DB record, never from
//     the request payload, so a forged call can only re-host existing data.
//  2. Manual backfill (admin only) — payload { backfill: true, entity?, limit? }.
//     Scans records for external URLs and migrates them in batches.
//
// Records whose source link has already died are left untouched and reported.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { persistUrl, isExternalUrl } from '../../shared/persistMedia.ts';

// Which URL fields to persist per entity
const ENTITY_FIELDS = {
  TrackSubmission: ['track_url', 'cover_image_url'],
  UserAsset: ['file_url', 'thumbnail_url'],
  GenerationJob: ['output_url'],
};

async function persistRecord(base44, entityName, record) {
  const fields = ENTITY_FIELDS[entityName];
  if (!fields) return { updated: false, dead: [] };
  const updates = {};
  const dead = [];
  const baseName = (record.title || record.track_title || entityName).slice(0, 60);

  for (const field of fields) {
    const current = record[field];
    if (!isExternalUrl(current)) continue;
    const ext = field.includes('image') || field.includes('thumbnail') ? 'jpg'
      : record.job_type === 'video' || record.asset_type === 'video' ? 'mp4' : 'mp3';
    const { url, persisted } = await persistUrl(base44, current, `${baseName}_${field}.${ext}`);
    if (persisted && url) updates[field] = url;
    else if (!url) dead.push(field);
  }

  // GenerationJob: also persist cover art inside output_metadata
  if (entityName === 'GenerationJob' && isExternalUrl(record.output_metadata?.cover_image_url)) {
    const { url, persisted } = await persistUrl(base44, record.output_metadata.cover_image_url, `${baseName}_cover.jpg`);
    if (persisted && url) updates.output_metadata = { ...record.output_metadata, cover_image_url: url };
    else if (!url) dead.push('output_metadata.cover_image_url');
  }

  if (Object.keys(updates).length > 0) {
    await base44.asServiceRole.entities[entityName].update(record.id, updates);
    return { updated: true, dead };
  }
  return { updated: false, dead };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));

    // ── Mode 1: entity automation — persist the single record that changed ──
    if (payload?.event?.entity_name && payload?.event?.entity_id) {
      const { entity_name, entity_id } = payload.event;
      if (!ENTITY_FIELDS[entity_name]) return Response.json({ ok: true, skipped: 'unsupported entity' });
      const recs = await base44.asServiceRole.entities[entity_name].filter({ id: entity_id });
      const record = recs[0];
      if (!record) return Response.json({ ok: true, skipped: 'record not found' });
      const result = await persistRecord(base44, entity_name, record);
      return Response.json({ ok: true, ...result });
    }

    // ── Mode 2: admin backfill ──
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const limit = Math.min(Number(payload.limit) || 8, 20);
    const entities = payload.entity ? [payload.entity] : Object.keys(ENTITY_FIELDS);
    const summary = {};
    let budget = limit; // total records migrated this run (function time limit)

    for (const entityName of entities) {
      if (budget <= 0) break;
      const fields = ENTITY_FIELDS[entityName];
      // Scan the most recent records and pick those with external URLs
      const stats = { scanned: 0, migrated: 0, dead: 0, remaining_external: 0 };
      const page = await base44.asServiceRole.entities[entityName].list('-created_date', 500);
      stats.scanned = page.length;
      for (const record of page) {
        const hasExternal = fields.some(f => isExternalUrl(record[f])) ||
          (entityName === 'GenerationJob' && isExternalUrl(record.output_metadata?.cover_image_url));
        if (!hasExternal) continue;
        if (budget <= 0) { stats.remaining_external++; continue; }
        const { updated, dead } = await persistRecord(base44, entityName, record);
        if (updated) { stats.migrated++; budget--; }
        if (dead.length) stats.dead++;
        if (!updated && !dead.length) stats.remaining_external++;
      }
      summary[entityName] = stats;
    }

    return Response.json({ ok: true, summary, has_more: budget <= 0 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});