/**
 * Release metadata normalization at the GENERATION boundary.
 *
 * Genre and mood are stored on a track once, when it is generated, and every
 * later consumer (library, DDEX export, Audius publish) reads that stored value.
 * Normalizing here rather than at publish time is what makes the pipeline clean:
 * a value that reaches the library is already distributable, so no downstream
 * step has to guess, and a missing value stays MISSING instead of being silently
 * defaulted into a false claim about the recording.
 *
 * Deliberately shares its vocabulary with audiusMetadata.ts — that module still
 * normalizes at the boundary it owns (imported tracks, legacy rows), but for
 * anything generated here it now receives a value that is already valid.
 */

import { normalizeAudiusGenre, normalizeAudiusMood } from './audiusMetadata.ts';

/**
 * Normalizes a creator-supplied genre, or returns null when none was given.
 *
 * Returns null rather than a fallback on purpose: at generation time an unset
 * genre means the creator has not labelled the track yet, which is a different
 * fact from "this track is Electronic". Only the publish step, which must send
 * something, is allowed to substitute a default.
 */
export function normalizeGenre(raw) {
  if (!raw || !String(raw).trim()) return null;
  return normalizeAudiusGenre(raw, null) || null;
}

/** Normalizes a creator-supplied mood, or returns null when none was given. */
export function normalizeMood(raw) {
  if (!raw || !String(raw).trim()) return null;
  return normalizeAudiusMood(raw) || null;
}

/**
 * The pair as a studio submits it, ready to spread into GenerationJob.input_data.
 * Keys are always present (null when unset) so a job row states plainly that the
 * question was asked, which is what lets a backfill tell "never labelled" apart
 * from "labelled before this field existed".
 */
export function releaseMetadata({ genre, mood }) {
  return { genre: normalizeGenre(genre), mood: normalizeMood(mood) };
}