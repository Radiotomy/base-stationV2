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
import { resolvePayload } from './baseMarkResolve.ts';

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
      // The spectral layer carries 32 bits and nothing else, so its payload
      // FORMAT is not recoverable from the audio — it is a property of the
      // registry row, not of the signal. Resolution decides it, not detection.
      payload_version: null,
      requires_registry_corroboration: false,
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
      const { valid, payload_hex, payload_version, requires_registry_corroboration } = await unpackMessage(v2.messages[0]);
      if (valid) {
        return {
          detected: true, payload_hex, engine: 'neural',
          // Phase 1: which message format matched. A LEGACY match is still
          // constructible from public information, so it is surfaced as needing
          // registry corroboration rather than silently ranked equal to a keyed
          // match. PHASE 2 is where the caller must act on this.
          payload_version,
          requires_registry_corroboration,
          slot_hex: null, asset_id: null, reason: null, too_short: false, layers_tried: layersTried,
        };
      }
    }
  } catch { /* best effort */ }

  return { ...miss, layers_tried: layersTried };
}

/**
 * Public registry matches for a detection.
 *
 * PHASE 2: this is now a thin shim over the single resolver, which means it
 * returns matches ONLY when the payload resolves to exactly one registered asset
 * and passes the format check. It used to return up to five rows as equals,
 * which presented a payload collision as a list of co-owners instead of the
 * abstention it has to be. Callers that need the reason, not just the rows,
 * should use confirmDetection() from baseMarkResolve.ts directly.
 */
export async function registryMatches(base44, detection) {
  const verdict = await resolvePayload(base44, detection);
  return verdict.matches;
}