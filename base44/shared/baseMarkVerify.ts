// BASE Mark — unified two-layer verification funnel (Phase 4).
//
// Until now each layer had its own detector and each caller wired them up by
// hand, which meant the answer to "is this ours?" depended on which endpoint
// you asked. This module is the single answer.
//
// ORDER IS COST, NOT PREFERENCE. The layers run cheapest-first and stop at the
// first confident hit:
//
//   1. V1 spectral — pure DSP, in-memory, free, milliseconds. Survives most
//      everyday handling but dies to heavy lossy compression.
//   2. V2 neural  — GPU, seconds, real money. Closes exactly the codec gap V1
//      loses to.
//
// A third layer (V3 drift / WavMark) previously sat behind these. It was
// decommissioned after failing robustness benchmarks on real masterings, with
// zero slots ever allocated and zero assets ever marked — so removing it could
// not lose a recoverable identity. See src/docs/BASE_MARK_V3_ARCHIVE.md for the
// full record and the rebuild path. Tempo-stretch coverage is now the Print
// Layer's problem (basePrint.ts), which identifies rather than protects.
//
// GPU LAYERS ARE OPT-IN. Anonymous public traffic is overwhelmingly misses, and
// each miss would cold-start a GPU. Callers pass allowGpu explicitly.

import { detectMark } from './baseMark.ts';
import { decodeV2, unpackMessage } from './baseMarkV2.ts';

// Replicate models return either an inline object or a URL to a JSON file,
// depending on how the container declares its output. Accept both.
async function resolveJson(output) {
  if (!output) return null;
  if (typeof output === 'object' && !Array.isArray(output)) return output;
  const url = typeof output === 'string' ? output : Array.isArray(output) ? output[0] : null;
  if (typeof url !== 'string' || !url.startsWith('http')) return null;
  const r = await fetch(url);
  return r.ok ? await r.json() : null;
}

/**
 * Run the funnel over raw WAV bytes.
 *
 * Returns a uniform result regardless of which layer resolved it:
 *   { detected, payload_hex, engine, slot_hex, asset_id, reason, too_short, layers_tried }
 *
 * Never throws on a layer failure — a transient GPU error degrades the funnel
 * to the layers that did answer rather than failing the whole verification.
 */
export async function verifyAudioBytes(base44, bytes, { allowGpu = false } = {}) {
  const layersTried = [];
  let uploadedUrl = null;

  // Layer 1 — spectral. Free, so always.
  layersTried.push('spectral');
  const v1 = detectMark(bytes);
  if (v1.detected && v1.payload_hex) {
    return {
      detected: true, payload_hex: v1.payload_hex, engine: 'acoustic',
      slot_hex: null, asset_id: null, reason: null, too_short: false, layers_tried: layersTried,
    };
  }

  const miss = {
    detected: false, payload_hex: null, engine: null, slot_hex: null, asset_id: null,
    reason: v1.reason || null, too_short: !!v1.too_short, layers_tried: layersTried,
  };

  // No audio is short enough for a GPU layer to rescue if V1 says there are not
  // enough samples to analyze at all — skip straight to the miss.
  if (!allowGpu || v1.too_short) return miss;

  // Both GPU layers need the audio at a URL; upload once and share it.
  try {
    const file = new Blob([bytes], { type: 'audio/wav' });
    const up = await base44.asServiceRole.integrations.Core.UploadFile({ file });
    uploadedUrl = up?.file_url || null;
  } catch { /* fall through — GPU layers simply cannot run */ }
  if (!uploadedUrl) return miss;

  // Layer 2 — neural. phaseShift because submissions are usually crops.
  layersTried.push('neural');
  try {
    const v2 = await resolveJson(await decodeV2(uploadedUrl, { phaseShift: true }));
    if (v2?.detected && Array.isArray(v2.messages) && v2.messages.length > 0) {
      const { valid, payload_hex } = unpackMessage(v2.messages[0]);
      if (valid) {
        return {
          detected: true, payload_hex, engine: 'neural',
          slot_hex: null, asset_id: null, reason: null, too_short: false, layers_tried: layersTried,
        };
      }
    }
  } catch { /* best effort */ }

  return { ...miss, layers_tried: layersTried };
}

/** Public registry matches for a resolved detection. Never exposes internals. */
export async function registryMatches(base44, { payload_hex, asset_id }) {
  const rows = [];
  if (asset_id) {
    const a = await base44.asServiceRole.entities.UserAsset.get(asset_id).catch(() => null);
    if (a) rows.push(a);
  }
  if (payload_hex) {
    const [v1Rows, v2Rows] = await Promise.all([
      base44.asServiceRole.entities.UserAsset.filter({ 'metadata.base_mark.payload_hex': payload_hex }, '-created_date', 5),
      base44.asServiceRole.entities.UserAsset.filter({ 'metadata.base_mark_v2.payload_hex': payload_hex }, '-created_date', 5),
    ]);
    rows.push(...(v1Rows || []), ...(v2Rows || []));
  }
  const seen = new Set();
  return rows
    .filter((a) => !seen.has(a.id) && seen.add(a.id))
    .slice(0, 5)
    .map((a) => ({
      title: a.title,
      asset_type: a.asset_type,
      created_date: a.created_date,
      marked_at: a.metadata?.base_mark_v2?.embedded_at
        || a.metadata?.base_mark?.embedded_at
        || null,
    }));
}