/**
 * Provider Routing Intelligence
 * Centralized routing matrix: given track parameters, picks the optimal provider
 * and returns a ranked fallback chain with a human-readable reason.
 *
 * Priority axes (in order):
 *   1. Duration > 360s          → Tempolor (Sonic caps its `duration` target at 6 min;
 *                                  Tempolor/MiniMax reach 5–6 min natively)
 *   2. Vocal / needs_lyrics      → Sonic v5 (best vocal fidelity after Nuro deprecation)
 *   3. Multiple variations       → Sonic v5 (returns 2 clips per call)
 *   4. Speed priority            → TemPolor i3 instrumental / Sonic v5 vocal
 *   5. Default / general purpose → Sonic v5
 *
 * Audit 2026-09-03: the old ">120s → Tempolor" rule predates Sonic's `duration`
 * field (10–360s). Sonic now handles full-length songs directly.
 */

export const PROVIDER_DETAILS = {
  sonic:      { label: 'Sonic',      model: 'sonic-v5',        emoji: '🎵', color: 'border-cyan-500 bg-cyan-500/10 text-cyan-300' },
  tempcolor:  { label: 'Tempolor',   model: 'tempolor-latest', emoji: '🎶', color: 'border-amber-500 bg-amber-500/10 text-amber-300' },
  elevenlabs: { label: 'ElevenLabs', model: 'music_v1',        emoji: '🎧', color: 'border-violet-500 bg-violet-500/10 text-violet-300' },
};

// Human-readable provider name for any provider key (covers legacy internal ids)
const EXTRA_LABELS = { nuro: 'Nuro', core: 'Core (AI)', ltx: 'LTX Video' };
export function providerLabel(key) {
  return PROVIDER_DETAILS[key]?.label || EXTRA_LABELS[key] || key;
}

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
  // Rule 1: Very long duration (> 360s) — beyond Sonic's target-length ceiling
  if (duration > 360) {
    return {
      provider: 'tempcolor',
      model: needs_lyrics ? 'tempolor-latest' : 'TemPolor i4',
      tempolor_mode: needs_lyrics ? 'song' : 'instrumental',
      reason: `Tempolor selected — requested length exceeds Sonic's 6-minute ceiling.`,
      routing_key: 'long_duration',
      fallbackChain: ['sonic'],
    };
  }

  // Rule 2: Vocal / lyrics-heavy — Sonic v4-5-plus has strong vocal quality
  if (needs_lyrics) {
    return {
      provider: 'sonic',
      model: 'sonic-v5',
      reason: `Sonic v5 selected — default model, strongest vocals and 2 tracks per run.`,
      routing_key: 'vocal_track',
      fallbackChain: ['tempcolor'],
    };
  }

  // Rule 3: Multiple variations requested — Sonic returns 2 clips per call
  if (want_variations) {
    return {
      provider: 'sonic',
      model: 'sonic-v5',
      reason: `Sonic v5 selected — generates 2 track variations per call for comparison.`,
      routing_key: 'multiple_variations',
      fallbackChain: ['tempcolor'],
    };
  }

  // Rule 4: Speed priority — TemPolor i3 generates instrumentals in under 3 seconds
  // (industry-leading per Tempolor docs); vocal tracks stay on Sonic v4-5-plus.
  if (speed_priority) {
    if (!needs_lyrics) {
      return {
        provider: 'tempcolor',
        model: 'TemPolor i3',
        tempolor_mode: 'instrumental',
        reason: `TemPolor i3 selected — fastest instrumental generation (under 3 seconds).`,
        routing_key: 'speed_priority_instrumental',
        fallbackChain: ['sonic'],
      };
    }
    return {
      provider: 'sonic',
      model: 'sonic-v5',
      reason: `Sonic v5 selected — fastest reliable route for vocal tracks.`,
      routing_key: 'speed_priority',
      fallbackChain: ['tempcolor'],
    };
  }

  // Rule 5: General purpose default — Sonic v5 is the platform default model
  return {
    provider: 'sonic',
    model: 'sonic-v5',
    reason: `Sonic v5 selected — platform default, 2 tracks per generation.`,
    routing_key: 'general_purpose',
    fallbackChain: ['tempcolor'],
  };
}