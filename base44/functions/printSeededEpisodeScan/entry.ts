import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { extractQueryPrint, loadReferencePrints } from '../../shared/printRegistry.ts';
import { attemptSeededRecovery } from '../../shared/printSeededRecovery.ts';
import { resolvePayload } from '../../shared/baseMarkResolve.ts';

// Print-seeded verification for an ORVO episode.
//
// This is the fall-through stage AFTER the standard cascade has found nothing.
// It exists for one specific gap: pitch-preserved tempo stretch — "sped up 1.2x
// to tighten the monologue" — which is the single most common long-form podcast
// edit and which every embedded layer (V1, V2, retired V3, V4) measures at 0%.
// Overlap-add resynthesis discards the fine phase structure a chip sequence
// lives in, so no watermark survives it and no inverse stretch restores it. The
// Print Layer is the only thing that can cross that gap, because it embeds
// nothing and reads ratios the resynthesis preserves.
//
// THE RESULT IS ADVISORY. Three independent reasons, all of which must be fixed
// before any promotion:
//   1. The Print lift statistic provably cannot gate acceptance — measured
//      unrelated lift overlaps genuine warped matches.
//   2. Everything measured so far was MUSIC at 20 seconds. Speech is spectrally
//      sparser and podcasts run 20-60 minutes. That calibration has not landed.
//   3. Registry confirmation is required but is not by itself a calibration.
// So this writes to Episode.print_recovery with standing 'advisory' and touches
// neither ai_disclosure_label nor the Creative Ownership Score.
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

    const writeResult = async (payload) => {
      const updated = await base44.asServiceRole.entities.Episode.update(episodeId, {
        print_recovery: { standing: 'advisory', scanned_at: new Date().toISOString(), ...payload },
      });
      return updated;
    };

    // Query prints are dithered and bounded. The bound is a CPU budget, not a
    // quality choice: a 45-minute episode at full length would extract hundreds
    // of thousands of hashes and exceed the function limit. Warp estimation
    // needs a long-enough span for a precise slope, not the whole file.
    const query = await extractQueryPrint(source, { maxSeconds: 180 });
    if (!query.ok) {
      const updated = await writeResult({
        recovered: false,
        registry_confirmed: false,
        reason: query.reason,
      });
      return Response.json({
        ok: true,
        recovered: false,
        reason: query.reason,
        note: query.reason === 'non_pcm_source'
          ? 'This episode\'s audio is a compressed container, which this runtime cannot decode server-side. That is a limit on what we can READ — it is not a finding that the audio does not match.'
          : null,
        episode: updated,
      });
    }

    // Compare against speech references only. Pooling music prints into a
    // spoken-word query would import a false-positive population measured on
    // completely different material, and the whole point of this stage is to
    // find out what speech actually does.
    const refs = await loadReferencePrints(base44, {
      contentClass: 'speech',
      limit: Number(body.limit) || 25,
      excludeAssetId: episode.base_mark_asset_id || undefined,
    });

    if (!refs.length) {
      const updated = await writeResult({
        recovered: false,
        registry_confirmed: false,
        reason: 'no_reference_prints',
      });
      return Response.json({
        ok: true,
        recovered: false,
        reason: 'no_reference_prints',
        note: 'No registered spoken-word prints to compare against yet. Build fingerprints on registered episodes first.',
        episode: updated,
      });
    }

    const result = attemptSeededRecovery(query.hashes, query.audio, refs);

    if (!result.recovered) {
      const updated = await writeResult({
        recovered: false,
        registry_confirmed: false,
        reason: result.reason,
        telemetry: { candidates_considered: result.candidates_considered, best_candidate: result.best_candidate || null },
      });
      return Response.json({ ok: true, recovered: false, reason: result.reason, episode: updated });
    }

    // MANDATORY registry confirmation (FORENSIC_SPEC §8). A recovered payload
    // that resolves to no registered asset is a false positive, and is discarded
    // rather than reported — the whole reason the spectral detector, not the
    // Print, owns this decision.
    // PHASE 5: through the single gate (§8.2). The previous lookup here queried
    // the V1 index alone and took [0] of a limit-1 filter, which made a payload
    // collision structurally invisible — it would attribute an episode to the
    // most recent of several claimants — and discarded, as "not in registry",
    // any asset registered only under the neural layer.
    const verdict = await resolvePayload(base44, result);

    if (!verdict.attributed) {
      const updated = await writeResult({
        recovered: true,
        registry_confirmed: false,
        reason: verdict.status,
        telemetry: {
          lift: result.lift,
          beta: result.beta,
          offset_ppm: result.offset_ppm,
          owner_count: verdict.owner_count,
        },
      });
      return Response.json({
        ok: true,
        recovered: false,
        reason: verdict.status,
        note: 'A payload decoded but could not be attributed to exactly one registered asset, so it is discarded.',
        episode: updated,
      });
    }

    const confirmed = verdict.asset;

    const updated = await writeResult({
      recovered: true,
      registry_confirmed: true,
      matched_asset_id: confirmed.id,
      matched_title: confirmed.title || '',
      payload_hex: result.payload_hex,
      // beta of exactly 1 would mean no warp was needed; anything else means the
      // recovery only happened after re-timing was undone.
      re_timing_detected: Math.abs(result.beta - 1) > 0.002,
      telemetry: {
        lift: result.lift,
        beta: result.beta,
        ratio_applied: result.ratio_applied,
        offset_ppm: result.offset_ppm,
        inliers: result.inliers,
        residual_rms: result.residual_rms,
        mean_strength: result.mean_strength,
        search_gate: result.search_gate,
        references_compared: refs.length,
      },
    });

    return Response.json({
      ok: true,
      recovered: true,
      registry_confirmed: true,
      matched_title: confirmed.title,
      episode: updated,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}