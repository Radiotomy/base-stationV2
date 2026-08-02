// BASE SoundForge — our loop / one-shot / sample engine.
//
// LICENSE (verified 2026-08-02): runs on ACE-Step v1.5, Apache 2.0
// (github.com/ace-step/ACE-Step). Irrevocable, no revenue cap, no registration,
// no enterprise licence at any revenue level. Fine-tunes (LoRA) permitted.
//
// Migrated 2026-08-02 off Stable Audio Open 1.0, which shipped under the
// Stability AI Community License: free only under USD $1M total annual revenue,
// registration required, and a negotiated (unpublished, quote-only) Enterprise
// Licence above that. SoundForge now shares the same base model as
// BASE-Harmonix, so the platform carries exactly one model licence.
//
// Model + version are resolved from shared/harmonix.ts, with env overrides so a
// loop-tuned LoRA can be swapped in later without a code change.

import {
  HARMONIX_MODEL,
  HARMONIX_VERSION,
  startHarmonix,
  getHarmonixPrediction,
  extractAudioUrl,
} from './harmonix.ts';

export const SOUNDFORGE_MODEL =
  Deno.env.get('SOUNDFORGE_MODEL') || HARMONIX_MODEL;
export const SOUNDFORGE_VERSION =
  Deno.env.get('SOUNDFORGE_VERSION') || HARMONIX_VERSION;

export const SOUNDFORGE_CREDIT_COST = 2;
export const SOUNDFORGE_MAX_DURATION = 30;

// Loops and one-shots are short and never sung — a low step count keeps them
// fast and cheap, and ACE-Step treats "[instrumental]" as no-vocals.
export const SOUNDFORGE_INFER_STEPS = 27;
export const SOUNDFORGE_INSTRUMENTAL = '[instrumental]';

export async function startSoundForge(input) {
  return await startHarmonix(input);
}

export async function getSoundForgePrediction(id) {
  return await getHarmonixPrediction(id);
}

export function extractSoundForgeAudioUrl(output) {
  return extractAudioUrl(output);
}