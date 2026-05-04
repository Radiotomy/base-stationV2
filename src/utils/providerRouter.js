/**
 * Phase 3 — Provider Routing Intelligence
 * Centralized routing matrix: given track parameters, picks the optimal provider
 * and returns a ranked fallback chain with a human-readable reason.
 *
 * Priority axes (in order):
 *   1. Duration > 120s          → Tempolor (only provider supporting up to 5 min)
 *   2. Vocal / needs_lyrics      → Nuro v2.0 (best vocal fidelity)
 *   3. Multiple variations       → Sonic v5-5 (returns 2 clips per call)
 *   4. Speed priority            → Loudly VEGA_2 (synchronous, no polling)
 *   5. Default / general purpose → Sonic v4-5-plus (balanced quality)
 */

export const PROVIDER_DETAILS = {
  sonic:     { label: 'Sonic',    model: 'sonic-v4-5-plus', emoji: '🎵', color: 'border-cyan-500 bg-cyan-500/10 text-cyan-300' },
  tempcolor: { label: 'Tempolor', model: 'TemPolor v4.6',   emoji: '🎶', color: 'border-amber-500 bg-amber-500/10 text-amber-300' },
  producer:  { label: 'Producer', model: 'FUZZ-2.0',        emoji: '🎤', color: 'border-purple-500 bg-purple-500/10 text-purple-300' },
  nuro:      { label: 'Nuro',     model: 'v2.0',            emoji: '🎼', color: 'border-pink-500 bg-pink-500/10 text-pink-300' },
  loudly:    { label: 'Loudly',   model: 'VEGA_2',          emoji: '🔊', color: 'border-blue-500 bg-blue-500/10 text-blue-300' },
};

/**
 * Returns { provider, model, reason, fallbackChain }
 *
 * @param {object} params
 * @param {number}  params.duration       - Track duration in seconds
 * @param {boolean} params.needs_lyrics   - Whether the track needs vocals/lyrics
 * @param {boolean} params.want_variations - Whether user wants multiple variations
 * @param {boolean} params.speed_priority  - Whether user prefers fast result
 * @param {string}  params.genre          - Genre string
 * @param {string}  params.mood           - Mood string
 */
export function routeProvider({
  duration = 60,
  needs_lyrics = false,
  want_variations = false,
  speed_priority = false,
  genre = '',
  mood = '',
} = {}) {
  // Rule 1: Long duration (> 120s) — only Tempolor supports up to 5 min
  if (duration > 120) {
    return {
      provider: 'tempcolor',
      model: needs_lyrics ? 'TemPolor v4.6' : 'TemPolor i3.5',
      tempolor_mode: needs_lyrics ? 'song' : 'instrumental',
      reason: `Tempolor selected — only provider supporting tracks over 2 minutes (up to 5 min).`,
      routing_key: 'long_duration',
      fallbackChain: ['sonic', 'producer'],
    };
  }

  // Rule 2: Vocal / lyrics-heavy — Nuro has best vocal fidelity
  if (needs_lyrics) {
    return {
      provider: 'nuro',
      model: 'v2.0',
      nuro_version: 'v2.0',
      reason: `Nuro selected — best vocal generation quality for lyric-driven tracks.`,
      routing_key: 'vocal_track',
      fallbackChain: ['sonic', 'producer', 'tempcolor'],
    };
  }

  // Rule 3: Multiple variations requested — Sonic returns 2 clips per call
  if (want_variations) {
    return {
      provider: 'sonic',
      model: 'sonic-v5-5',
      reason: `Sonic selected — generates 2 track variations per call for comparison.`,
      routing_key: 'multiple_variations',
      fallbackChain: ['producer', 'nuro', 'loudly'],
    };
  }

  // Rule 4: Speed priority — Loudly is synchronous (no polling needed)
  if (speed_priority) {
    return {
      provider: 'loudly',
      model: 'VEGA_2',
      reason: `Loudly selected — synchronous generation, fastest result (no queue wait).`,
      routing_key: 'speed_priority',
      fallbackChain: ['sonic', 'producer'],
    };
  }

  // Rule 5: General purpose default — Sonic v4-5-plus balanced quality
  return {
    provider: 'sonic',
    model: 'sonic-v4-5-plus',
    reason: `Sonic selected — best general-purpose quality for this track type.`,
    routing_key: 'general_purpose',
    fallbackChain: ['producer', 'loudly', 'nuro', 'tempcolor'],
  };
}