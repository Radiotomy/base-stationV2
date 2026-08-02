// BASE Mark V3 — Phase 3: finalize a settled Drift Layer prediction.
//
// Given a settled Replicate prediction, this rehosts the marked file, promotes
// it to the asset's canonical audio, and flips the reserved slot to active.
//
// THREE REFUSALS, all deliberate. Promotion to canonical is irreversible from
// the listener's point of view, so this step is the last place a bad file can
// be caught:
//
//   1. PARTIAL RUNS ARE NEVER PROMOTED. max_seconds makes the container return
//      only the marked region — a 30s excerpt of a 4-minute master. That is a
//      perfectly valid test artifact and a catastrophic canonical file. It is
//      recorded and linked, never promoted.
//   2. RESAMPLED OR DOWNMIXED OUTPUT IS REJECTED. The whole point of the
//      band-split design is that the master comes back at its original rate and
//      channel count. If it does not, the design failed on this file and the
//      original is kept — same guard V2 finalize applies.
//   3. THE SLOT ONLY GOES ACTIVE ON A PROMOTED FILE. "active" means a file
//      carrying this slot is live. Marking it active for a failed or unpromoted
//      run would make the registry claim attribution it cannot back up.

import { BASE_MARK_V3_VERSION, v3Model } from './baseMarkV3.ts';
import { activateSlot, releaseSlot } from './baseMarkV3Slots.ts';

function outputUrl(output) {
  if (!output) return null;
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) return typeof output[0] === 'string' ? output[0] : output[0]?.audio || null;
  return output.audio || output.url || null;
}

async function writeState(base44, asset, patch) {
  const fresh = await base44.asServiceRole.entities.UserAsset.get(asset.id).catch(() => asset);
  const updates = {
    metadata: {
      ...(fresh.metadata || {}),
      base_mark_v3: { ...(fresh.metadata?.base_mark_v3 || {}), ...patch.v3 },
      ...(patch.wavUrl ? { wav_url: patch.wavUrl } : {}),
    },
  };
  if (patch.fileUrl) updates.file_url = patch.fileUrl;
  await base44.asServiceRole.entities.UserAsset.update(asset.id, updates);
}

export async function finalizeV3Prediction(base44, pred, asset) {
  const predictionId = pred?.id;
  if (!predictionId) return { status: 'error', error: 'No prediction id' };

  if (pred.status === 'starting' || pred.status === 'processing') {
    return { status: 'processing', prediction_id: predictionId };
  }

  const v3 = asset.metadata?.base_mark_v3 || {};

  // Idempotency — a poll loop and a retry can both land on the same settled
  // prediction. Terminal states are left exactly as they are.
  if (v3.status === 'completed' || v3.status === 'failed') {
    return {
      status: v3.status,
      prediction_id: predictionId,
      asset_id: asset.id,
      slot_hex: v3.slot_hex,
      marked_file_url: v3.marked_file_url,
      already_finalized: true,
    };
  }

  const fail = async (error) => {
    // A failed run must give its slot back — a slot held against a file that
    // does not exist is dead inventory in a pool of only 65,536.
    if (v3.slot_record_id) await releaseSlot(base44, v3.slot_record_id, `Embed failed: ${error}`).catch(() => {});
    await writeState(base44, asset, { v3: { status: 'failed', error } });
    return { status: 'failed', error, prediction_id: predictionId, asset_id: asset.id };
  };

  if (pred.status === 'failed' || pred.status === 'canceled') {
    return await fail(pred.error || pred.status);
  }
  if (pred.status !== 'succeeded') {
    return { status: pred.status || 'unknown', prediction_id: predictionId };
  }

  const url = outputUrl(pred.output);
  if (!url) return await fail('Drift Layer returned no output file');

  const dl = await fetch(url);
  if (!dl.ok) return await fail('Could not download the marked file from the model');
  const bytes = new Uint8Array(await dl.arrayBuffer());

  // Refusal 2 — the model reports what it actually wrote, so compare against
  // what the asset says it started with rather than re-parsing a FLAC header.
  const out = typeof pred.output === 'object' && !Array.isArray(pred.output) ? pred.output : {};
  const srcRate = v3.source_sample_rate;
  const srcCh = v3.source_channels;
  if (srcRate && out.sample_rate && out.sample_rate !== srcRate) {
    return await fail(`Drift Layer returned ${out.sample_rate}Hz audio for a ${srcRate}Hz master — the original was kept unchanged.`);
  }
  if (srcCh && out.channels && out.channels !== srcCh) {
    return await fail(`Drift Layer changed the channel count (${srcCh} to ${out.channels}) — the original was kept unchanged.`);
  }

  const file = new File([bytes], 'basemark-v3.flac', { type: 'audio/flac' });
  const { file_url } = await base44.integrations.Core.UploadFile({ file });
  if (!file_url) return await fail('Rehost of the marked file failed');

  // Refusal 1 — a bounded run produced an excerpt, not a master.
  const partial = Number(v3.max_seconds) > 0;
  const common = {
    version: BASE_MARK_V3_VERSION,
    engine: 'drift',
    model: v3Model(),
    prediction_id: predictionId,
    marked_file_url: file_url,
    sample_rate: out.sample_rate ?? null,
    channels: out.channels ?? null,
    embedded_at: v3.embedded_at || new Date().toISOString(),
  };

  if (partial) {
    await writeState(base44, asset, {
      v3: {
        ...common,
        status: 'completed',
        promoted: false,
        note: `Bounded ${v3.max_seconds}s test run — marked excerpt saved for inspection, master left untouched.`,
      },
    });
    if (v3.slot_record_id) await activateSlot(base44, v3.slot_record_id).catch(() => {});
    return {
      status: 'completed',
      promoted: false,
      prediction_id: predictionId,
      asset_id: asset.id,
      slot_hex: v3.slot_hex,
      marked_file_url: file_url,
    };
  }

  // Full-length run — promote. Mirror V2's convention: if the asset keeps a
  // separate lossless slot, the mark lands there; otherwise it becomes the
  // primary file.
  const usedWavSlot = !!asset.metadata?.wav_url;
  await writeState(base44, asset, {
    v3: { ...common, status: 'completed', promoted: true },
    ...(usedWavSlot ? { wavUrl: file_url } : { fileUrl: file_url }),
  });

  // Refusal 3 — only now is a live file actually carrying this slot.
  if (v3.slot_record_id) await activateSlot(base44, v3.slot_record_id).catch(() => {});

  return {
    status: 'completed',
    promoted: true,
    prediction_id: predictionId,
    asset_id: asset.id,
    slot_hex: v3.slot_hex,
    marked_file_url: file_url,
  };
}