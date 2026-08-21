// Give a GENERATED loop a provenance registry row, so it can be marked at all.
//
// WHY THIS IS NEEDED: loops are LoopSample records, not UserAssets, and the BASE
// Mark registry is indexed exclusively on UserAsset (payloadOwners scans
// UserAsset metadata). Embedding a mark into a loop without a registry row would
// produce a payload that resolves to nothing — and resolvePayload correctly
// DISCARDS an unregistered payload as a false positive. So a loop with no
// registry row cannot be attributed no matter how well it is watermarked.
//
// The arrangement mirrors ORVO episodes: the UserAsset IS the forensic record,
// and the creator-facing row points at it via base_mark_asset_id. Creating that
// row is what makes the existing auto-mark workflow fire (asset_type 'loop' is
// in its trigger), so no watermarking logic is duplicated here.
//
// Only GENERATED loops are registered. An imported Freesound/CC0 sample is
// somebody else's recording: marking it would assert this creator made it, which
// is exactly the confident-wrong-attribution outcome the forensic spec forbids.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.43';
import { cosForDerived, contentHash } from '../../shared/cosStamp.ts';

// Sources that represent audio this platform generated for this creator.
const GENERATED_SOURCES = ['soundforge'];

// How recently a loop must have been created for the unauthenticated automation
// shape to act on it. Same reasoning as autoBaseMarkV2: the event body is
// caller-supplied, so it authorizes nothing on its own — every gate is
// re-derived from the stored record, and anything older is a replay.
const AUTOMATION_MAX_AGE_MS = 30 * 60 * 1000;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const isAutomation = body?.event?.entity_name === 'LoopSample';
    if (!isAutomation) {
      const user = await base44.auth.me().catch(() => null);
      if (!user || user.role !== 'admin') {
        return Response.json({ error: 'Forbidden: admin only for direct invocation' }, { status: 403 });
      }
    }

    const loopId = isAutomation ? body.event.entity_id : body?.loopId;
    if (!loopId) return Response.json({ skipped: true, reason: 'No loop id' });

    // Always the stored record — never body.data, which is attacker-controllable
    // on the automation path and feeds every gate below.
    const loop = await base44.asServiceRole.entities.LoopSample.get(loopId).catch(() => null);
    if (!loop) return Response.json({ skipped: true, reason: 'Loop not found' });

    if (isAutomation) {
      const ageMs = Date.now() - new Date(loop.created_date).getTime();
      if (!(ageMs >= 0 && ageMs < AUTOMATION_MAX_AGE_MS)) {
        return Response.json({ skipped: true, reason: 'Loop not newly created; use admin back-fill' });
      }
    }

    if (loop.base_mark_asset_id) {
      return Response.json({ skipped: true, reason: 'Already registered', asset_id: loop.base_mark_asset_id });
    }
    if (!GENERATED_SOURCES.includes(loop.source)) {
      // Recorded rather than silently ignored: 'unregistered' here is a
      // deliberate decision about someone else's recording, not an oversight.
      return Response.json({ skipped: true, reason: `Not generated audio (source: ${loop.source})` });
    }
    if (!loop.file_url || !loop.user_id) {
      return Response.json({ skipped: true, reason: 'Loop has no file or owner' });
    }

    const { fields: cos } = cosForDerived({
      prompt: loop.title || '',
      sourceCount: 0, // a generated loop has no source material supplied by the creator
      styleOrTags: [loop.category, ...(loop.tags || [])].filter(Boolean),
    });
    const hash = await contentHash([loop.user_id, 'soundforge', loop.id, loop.file_url]);

    const asset = await base44.asServiceRole.entities.UserAsset.create({
      user_id: loop.user_id,
      asset_type: 'loop',
      title: loop.title,
      description: loop.description || `Generated ${loop.category || 'loop'}`,
      file_url: loop.file_url,
      loop_sample_id: loop.id,
      origin: 'creator',
      ai_label: 'ai_generated',
      ...cos,
      c2pa_provenance_hash: hash,
      is_public: false, // the registry row is never a second public library entry
      tags: ['loop', loop.category, ...(loop.tags || [])].filter(Boolean),
      metadata: {
        content_hash: hash,
        cos_engine: '2.0',
        loop_sample_id: loop.id,
        provider: 'soundforge',
        bpm: loop.bpm || null,
        key: loop.key || null,
        duration: loop.duration_seconds || null,
        loop_spec: loop.loop_spec || null,
        provenance: { created_by: 'loop_studio', providers_used: ['soundforge'] },
      },
    });

    await base44.asServiceRole.entities.LoopSample.update(loop.id, {
      base_mark_asset_id: asset.id,
      provenance_status: 'processing',
    });

    return Response.json({ ok: true, loop_id: loop.id, asset_id: asset.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});