// ─────────────────────────────────────────────────────────────────
// COS ENGINE 2.0 — Creative Ownership Score (0–100)
// Granular, dimension-based human-participation scoring.
//
// Every point is traceable to a named signal, every signal rolls up
// into one of five creative dimensions aligned with the DDEX AI
// attribution categories, and a confidence metric records how much
// of the creative process was actually observed by telemetry.
//
// Backward compatible: same function signature, same flat
// participation_signals map (superset of v1 keys), same label
// threshold, same DDEX output shape.
// ─────────────────────────────────────────────────────────────────

export const COS_ENGINE_VERSION = '2.0';

// Signal registry — single source of truth for points, labels and
// the dimension each signal belongs to.
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
};

export const DIMENSIONS = {
  content_authorship: { label: 'Content Authorship',  ddex: 'ai_lyrical_content',  desc: 'Original lyrics, melodies or recordings supplied by the creator' },
  creative_direction: { label: 'Creative Direction',  ddex: 'ai_composition',      desc: 'Depth and musical specificity of the creator\u2019s instructions' },
  sonic_identity:     { label: 'Sonic Identity',      ddex: 'ai_instrumentation',  desc: 'Style choices and reference material shaping the sound' },
  vocal_identity:     { label: 'Vocal Identity',      ddex: 'ai_generated_vocals', desc: 'Creator-designed voice personas and vocal direction' },
  craft_refinement:   { label: 'Craft & Refinement',  ddex: 'ai_post_production',  desc: 'Iteration passes, performances and hands-on production work' },
};

// Musical-direction vocabulary — a prompt that speaks the language of
// music (structure, tempo, key, arrangement) shows real creative intent.
const MUSICAL_TERMS = /\b(bpm|tempo|key of|major|minor|verse|chorus|bridge|hook|intro|outro|drop|breakdown|arrangement|time signature|[0-9]{2,3}\s?bpm|4\/4|3\/4|6\/8|crescendo|staccato|legato|syncopat|chord|progression|melody|harmony|bassline|drum pattern|hi-?hat|snare|kick|reverb|delay|sidechain)\b/i;

// Telemetry fields the engine can observe — confidence = how many were reported.
const TELEMETRY_FIELDS = [
  'prompt', 'userProvidedContent', 'styleOrTags', 'referenceFile',
  'personaOrTemplate', 'isIteration', 'humanInstrumentPerformance',
  'hasSyntheticVocals', 'isAutomatedMaster',
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
    label: score >= 40 ? 'ai_assisted' : 'ai_generated',
    basis: buildBasisText(signals, confidence),
    ddex: mapTelemetryToDdex(inputs, score),
  };
}

// Roll a flat signal map (stored on any asset, v1 or v2) up into the
// five creative dimensions — each 0–100% of that dimension's ceiling.
export function deriveDimensions(signals = {}) {
  const totals = {};
  const maxes = {};
  Object.entries(SIGNAL_REGISTRY).forEach(([key, def]) => {
    maxes[def.dimension] = (maxes[def.dimension] || 0) + def.points;
    if (signals[key]) totals[def.dimension] = (totals[def.dimension] || 0) + def.points;
  });
  const out = {};
  Object.keys(DIMENSIONS).forEach((dim) => {
    out[dim] = {
      label: DIMENSIONS[dim].label,
      points: totals[dim] || 0,
      max: maxes[dim],
      pct: Math.round(((totals[dim] || 0) / maxes[dim]) * 100),
    };
  });
  return out;
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

// Fallback derivation for already-stored assets that predate ddex_ai_metadata:
// reconstructs the attribution profile from persisted score + signals.
export function deriveDdexFromAsset(asset = {}) {
  if (asset.ddex_ai_metadata && Object.keys(asset.ddex_ai_metadata).length > 0) {
    return asset.ddex_ai_metadata;
  }
  const s = asset.participation_signals || {};
  const score = asset.human_participation_score ?? 0;
  return {
    ai_lyrical_content: !s.user_content,
    ai_composition: score < 50 && !s.deep_prompt && !s.musical_specificity,
    ai_instrumentation: !s.reference_material && !s.human_performance,
    ai_generated_vocals: !!s.persona_used,
    ai_post_production: asset.asset_type === 'master',
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

export const SCORE_TIERS = [
  { key: 'co_creator',   label: 'Co-Creator',   emoji: '🏆', min: 70, max: 100, color: '#34d399', desc: 'Heavy human creative input — provided content, detailed direction, references' },
  { key: 'collaborator', label: 'Collaborator', emoji: '🎨', min: 40, max: 69,  color: '#a78bfa', desc: 'Meaningful human guidance — custom prompts, styles, templates' },
  { key: 'curator',      label: 'Curator',      emoji: '🤖', min: 0,  max: 39,  color: '#60a5fa', desc: 'Mostly AI-driven — minimal direction, let AI decide' },
];

export function getTier(score) {
  return SCORE_TIERS.find(t => score >= t.min && score <= t.max) || SCORE_TIERS[2];
}

export const OWNERSHIP_POLICY_TEXT =
  "Every piece of AI-generated content on this platform carries a GenAI disclosure label aligned with the music community's voluntary labeling program (RIAA, IFPI & partners, July 2026). The Creative Ownership Score (0–100) reflects how much human creative input shaped each item — every point traces to a named signal across five creative dimensions: content authorship, creative direction, sonic identity, vocal identity, and craft & refinement.";