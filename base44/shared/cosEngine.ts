// COS Engine 2.0 — AUTHORITATIVE server-side scoring engine.
// This is the single source of truth for Creative Ownership Score calculation.
// The frontend (src/utils/participationScore.js) calls the `calculateCos`
// backend function instead of computing scores locally.
export const COS_ENGINE_VERSION = '2.0';

export const SIGNAL_REGISTRY = {
  user_content:        { points: 35, dimension: 'content_authorship', label: 'Own content (lyrics, melody, recording)' },
  deep_prompt:         { points: 18, dimension: 'creative_direction', label: 'Deep creative prompt (200+ chars)' },
  detailed_prompt:     { points: 14, dimension: 'creative_direction', label: 'Detailed prompt (100+ chars)' },
  basic_prompt:        { points: 7,  dimension: 'creative_direction', label: 'Basic prompt (40+ chars)' },
  musical_specificity: { points: 6,  dimension: 'creative_direction', label: 'Musical direction (BPM, key, structure…)' },
  custom_style:        { points: 6,  dimension: 'sonic_identity',     label: 'Custom style / tags' },
  rich_style:          { points: 4,  dimension: 'sonic_identity',     label: 'Rich style palette (3+ selections)' },
  reference_material:  { points: 12, dimension: 'sonic_identity',     label: 'Reference material upload' },
  persona_used:        { points: 9,  dimension: 'vocal_identity',     label: 'Saved creative persona' },
  iteration:           { points: 8,  dimension: 'craft_refinement',   label: 'Iteration & refinement' },
  human_performance:   { points: 12, dimension: 'craft_refinement',   label: 'Human instrument performance' },
  // Designing a DSP chain by hand is production work the creator actually did,
  // so a baked Foundry patch RAISES the score rather than being ignored.
  human_dsp_design:    { points: 10, dimension: 'craft_refinement',   label: 'Own DSP chain designed in BASE Foundry' },
  // A recording a person performed end to end (a hosted podcast, a live take)
  // has no generation prompt to score. Without this signal such work capped out
  // around 50–65 and read as "low humanity" even though no AI touched it.
  human_recording:     { points: 65, dimension: 'content_authorship', label: 'Whole recording performed by a person (no generative AI)' },
};

export const DIMENSION_LABELS = {
  content_authorship: 'Content Authorship',
  creative_direction: 'Creative Direction',
  sonic_identity: 'Sonic Identity',
  vocal_identity: 'Vocal Identity',
  craft_refinement: 'Craft & Refinement',
};

// Musical-direction vocabulary — a prompt that speaks the language of
// music (structure, tempo, key, arrangement) shows real creative intent.
const MUSICAL_TERMS = /\b(bpm|tempo|key of|major|minor|verse|chorus|bridge|hook|intro|outro|drop|breakdown|arrangement|time signature|[0-9]{2,3}\s?bpm|4\/4|3\/4|6\/8|crescendo|staccato|legato|syncopat|chord|progression|melody|harmony|bassline|drum pattern|hi-?hat|snare|kick|reverb|delay|sidechain)\b/i;

// Telemetry fields the engine can observe — confidence = how many were reported.
const TELEMETRY_FIELDS = [
  'prompt', 'userProvidedContent', 'styleOrTags', 'referenceFile',
  'personaOrTemplate', 'isIteration', 'humanInstrumentPerformance', 'humanDspDesign',
  'hasSyntheticVocals', 'isAutomatedMaster', 'fullyHumanRecording',
];

export function calculateHumanParticipationScore(inputs = {}) {
  const signals = {};
  const grant = (key) => { signals[key] = SIGNAL_REGISTRY[key].points; };

  // ── Content authorship ──
  if (inputs.userProvidedContent) grant('user_content');

  // ── Creative direction: graded prompt depth + musical specificity ──
  const prompt = inputs.prompt || '';
  if (prompt.length >= 200) grant('deep_prompt');
  else if (prompt.length >= 100) grant('detailed_prompt');
  else if (prompt.length >= 40) grant('basic_prompt');
  if (prompt && (prompt.match(MUSICAL_TERMS) || []).length > 0 && prompt.length >= 40) {
    grant('musical_specificity');
  }

  // ── Sonic identity ──
  const tagCount = Array.isArray(inputs.styleOrTags) ? inputs.styleOrTags.length : (inputs.styleOrTags ? 1 : 0);
  if (tagCount > 0) grant('custom_style');
  if (tagCount >= 3) grant('rich_style');
  if (inputs.referenceFile) grant('reference_material');

  // ── Vocal identity ──
  if (inputs.personaOrTemplate) grant('persona_used');

  // ── Craft & refinement ──
  if (inputs.isIteration) grant('iteration');
  if (inputs.humanInstrumentPerformance) grant('human_performance');
  if (inputs.humanDspDesign) grant('human_dsp_design');

  // Only a recording with no synthetic voice anywhere in it qualifies.
  const wholeHuman = !!inputs.fullyHumanRecording && !inputs.hasSyntheticVocals;
  if (wholeHuman) {
    grant('user_content');
    grant('human_recording');
  }

  const raw = Object.values(signals).reduce((a, b) => a + b, 0);
  const score = Math.min(100, raw);

  const dimensions = deriveDimensions(signals);
  const observed = TELEMETRY_FIELDS.filter((f) => inputs[f] !== undefined).length;
  const confidence = Math.round((observed / TELEMETRY_FIELDS.length) * 100);

  return {
    engine: COS_ENGINE_VERSION,
    score,
    signals,
    dimensions,
    confidence, // % of creative-process telemetry actually observed
    label: wholeHuman ? 'human' : score >= 40 ? 'ai_assisted' : 'ai_generated',
    basis: buildBasisText(signals, confidence),
    ddex: mapTelemetryToDdex(inputs, score),
  };
}

// DDEX mapping — dimension-aware granular AI attribution for partner export.
export function mapTelemetryToDdex(inputs = {}, finalScore = 0) {
  const prompt = inputs.prompt || '';
  const strongDirection = prompt.length >= 100 || (prompt.length >= 40 && MUSICAL_TERMS.test(prompt));
  return {
    ai_lyrical_content: !inputs.userProvidedContent,
    ai_composition: !strongDirection && !inputs.humanInstrumentPerformance && finalScore < 50,
    ai_instrumentation: !inputs.referenceFile && !inputs.humanInstrumentPerformance,
    ai_generated_vocals: !!inputs.hasSyntheticVocals || (!!inputs.personaOrTemplate && inputs.hasSyntheticVocals !== false),
    ai_post_production: !!inputs.isAutomatedMaster,
  };
}

function buildBasisText(signals, confidence) {
  const parts = Object.keys(signals)
    .map((k) => SIGNAL_REGISTRY[k]?.label?.toLowerCase())
    .filter(Boolean);
  if (!parts.length) return 'Fully AI-generated with minimal human direction.';
  const coverage = confidence >= 78 ? ' Full-process telemetry recorded.' : '';
  return `Score based on: ${parts.join(', ')}.${coverage}`;
}

// Roll a flat stored signal map (v1 or v2) into the five creative dimensions.
export function deriveDimensions(signals = {}) {
  const totals = {};
  const maxes = {};
  for (const [key, def] of Object.entries(SIGNAL_REGISTRY)) {
    maxes[def.dimension] = (maxes[def.dimension] || 0) + def.points;
    if (signals[key]) totals[def.dimension] = (totals[def.dimension] || 0) + def.points;
  }
  const out = {};
  for (const dim of Object.keys(DIMENSION_LABELS)) {
    out[dim] = {
      label: DIMENSION_LABELS[dim],
      points: totals[dim] || 0,
      max: maxes[dim],
      pct: Math.round(((totals[dim] || 0) / maxes[dim]) * 100),
    };
  }
  return out;
}