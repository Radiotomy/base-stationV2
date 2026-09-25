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

/**
 * Composition footprint — the hook run when a SheetSage2 transcription
 * completes. Reduces the engine's timed annotations to key, chord intervals and
 * structural boundaries, and hashes them canonically so the footprint can be
 * anchored on-chain alongside the audio fingerprint.
 *
 * Only the musical content is hashed (not timestamps of when it ran, not the
 * engine version), so re-transcribing the same audio yields the same hash.
 */
export async function compositionFootprint(summary: any = {}) {
  const r2 = (n: any) => Math.round(Number(n) * 100) / 100;
  const iv = (rows: any[] = []) => (Array.isArray(rows) ? rows : [])
    .filter((r) => r && r.label != null && Number.isFinite(Number(r.start)) && Number.isFinite(Number(r.end)))
    .map((r) => ({ start: r2(r.start), end: r2(r.end), label: String(r.label) }))
    .slice(0, 3000);

  const keys = iv(summary.keys);
  const chords = iv(summary.chords);
  const sections = iv(summary.sections);

  // Primary key = the key held for the longest total time.
  const held: Record<string, number> = {};
  for (const k of keys) held[k.label] = (held[k.label] || 0) + (k.end - k.start);
  const key = Object.keys(held).sort((a, b) => held[b] - held[a])[0] || null;

  const canonical = JSON.stringify({ v: 1, key, keys, chords, sections });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  const footprint_hash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');

  return {
    version: 1,
    key,
    keys,
    chords,
    sections,
    tempo_bpm: Number.isFinite(Number(summary.tempo_bpm)) ? Number(summary.tempo_bpm) : null,
    meter: summary.meter || null,
    chord_count: chords.length,
    section_count: sections.length,
    footprint_hash,
    hashed_fields: ['key', 'keys', 'chords', 'sections'],
  };
}