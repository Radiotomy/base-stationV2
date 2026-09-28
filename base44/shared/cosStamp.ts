// TRADE SECRET — BASE Station proprietary and confidential. Server-side only.
// Do not copy, publish, redistribute or import into client code.
// Creative Ownership Score stamping — the single place a GENERATED asset's COS
// is derived and written.
//
// WHY THIS EXISTS: cosEngine.ts has always been the authoritative scorer, but
// until now it was only ever called from the studio UI to DISPLAY a score. The
// asset that actually landed in the library was written by autoSaveJobAsset with
// a hardcoded 'ai_generated' label and NO score at all, and the derived-asset
// paths (harmony, visualizer, mashup) wrote literal numbers inline. So the
// engine's output was never the thing stored, which made every score on a card
// a recomputation rather than a record.
//
// This module closes that: telemetry is read off the GenerationJob that produced
// the asset, scored by the engine, and returned as the exact entity fields to
// write. Nothing here re-implements scoring — a second scoring rule is how a
// disclosure label starts disagreeing with itself.
//
// Applies to EVERY generated content type, not just audio. A video, a cover art
// or a lyric sheet has creative-process telemetry just as a track does, and an
// asset with no score is indistinguishable from an asset scored zero.

import { calculateHumanParticipationScore } from './cosEngine.ts';

/** Fields on a job's input_data that carry the creator's own written direction. */
const PROMPT_FIELDS = ['prompt', 'sound_prompt', 'text', 'topic', 'gpt_description_prompt', 'vibe_prompt'];

/** Fields whose presence means the creator supplied source material of their own. */
const REFERENCE_FIELDS = [
  'assetId', 'assetIds', 'cover_of', 'reference_image_url', 'reference_audio_url',
  'upload_audio_url', 'source_asset_id',
];

function firstString(obj: Record<string, unknown>, fields: string[]) {
  for (const f of fields) {
    const v = obj?.[f];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return '';
}

function hasAny(obj: Record<string, unknown>, fields: string[]) {
  return fields.some((f) => {
    const v = obj?.[f];
    return Array.isArray(v) ? v.length > 0 : !!v;
  });
}

/**
 * Read creative-process telemetry off a GenerationJob.
 *
 * Every field is reported explicitly — including the false ones — because the
 * engine's confidence figure counts how many telemetry fields were OBSERVED.
 * Omitting a field says "we never looked", which understates a score that was
 * in fact fully measured.
 */
export function telemetryFromJob(job: any = {}) {
  const input = job.input_data || {};
  const lyrics = typeof input.lyrics === 'string' ? input.lyrics.trim() : '';

  return {
    prompt: firstString(input, PROMPT_FIELDS),
    // Lyrics the creator typed are their own content. Lyrics a provider WROTE
    // arrive on output_metadata, never here, so this cannot credit AI text.
    userProvidedContent: lyrics.length > 0,
    styleOrTags: [input.genre, input.mood, input.style, input.category, input.tags]
      .flat()
      .filter((v) => typeof v === 'string' && v.trim()),
    referenceFile: hasAny(input, REFERENCE_FIELDS),
    personaOrTemplate: !!(input.voice_persona_id || input.persona_id || input.voice_id || input.template_key),
    isIteration: !!(input.parent_job_id || input.is_iteration || input.action === 'extend'),
    humanInstrumentPerformance: !!input.human_performance,
    humanDspDesign: !!(input.foundry_plugin_id || input.human_dsp_design),
    hasSyntheticVocals: !!(input.voice_persona_id || input.voice_id || (lyrics && !input.human_performance)),
    isAutomatedMaster: !!input.automated_master,
  };
}

/**
 * The entity fields that record a COS result. Written identically on every
 * asset type so a consumer never has to know which studio produced a row.
 */
export function cosFields(result: any) {
  return {
    ai_disclosure_label: result.label,
    ai_disclosure_basis: result.basis,
    human_participation_score: result.score,
    participation_signals: result.signals,
    ddex_ai_metadata: result.ddex,
  };
}

/** Score a job and return the fields to write. */
export function cosForJob(job: any) {
  const result = calculateHumanParticipationScore(telemetryFromJob(job));
  return { result, fields: cosFields(result) };
}

/**
 * Score a DERIVED asset (harmony, visualizer, mashup, stem) from its own inputs
 * rather than from a job, so the three studios that previously hardcoded a
 * number go through the same engine as everything else.
 */
export function cosForDerived({
  prompt = '',
  sourceCount = 1,
  styleOrTags = [],
  personaOrTemplate = false,
  isIteration = true,
}: {
  prompt?: string;
  sourceCount?: number;
  styleOrTags?: string[];
  personaOrTemplate?: boolean;
  isIteration?: boolean;
} = {}) {
  const result = calculateHumanParticipationScore({
    prompt,
    // A derived work never contains content the creator authored here — the
    // authorship credit belongs to the source asset, not to the derivation.
    userProvidedContent: false,
    styleOrTags,
    // Choosing and supplying the source material IS the reference signal.
    referenceFile: sourceCount > 0,
    personaOrTemplate,
    isIteration,
    humanInstrumentPerformance: false,
    humanDspDesign: false,
    hasSyntheticVocals: false,
    isAutomatedMaster: false,
  });
  return { result, fields: cosFields(result) };
}

/**
 * SHA-256 of the facts that identify a generated output. Content-addressable
 * provenance for the types BASE Mark cannot carry a signal in (video, image,
 * text) — it does not survive re-encoding like a watermark does, but it does
 * prove that a specific output came from a specific recorded generation.
 */
export async function contentHash(parts: unknown[]) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parts.map((p) => String(p ?? '')).join('|')));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}