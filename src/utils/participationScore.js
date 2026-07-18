// Creative Ownership Score — 0–100 Human Participation Score.
// Drives the ai_generated / ai_assisted disclosure label and creator tiers.

export function calculateHumanParticipationScore(inputs = {}) {
  let score = 0;
  const signals = {};

  // User provided their own content (lyrics, script, copy…)
  if (inputs.userProvidedContent) { signals.user_content = 40; score += 40; }

  // Deep / detailed prompt (>100 chars = intentional)
  if (inputs.prompt && inputs.prompt.length > 100) { signals.detailed_prompt = 15; score += 15; }
  else if (inputs.prompt && inputs.prompt.length > 40) { signals.basic_prompt = 8; score += 8; }

  // Custom style / genre / category tags
  if (inputs.styleOrTags && inputs.styleOrTags.length > 0) { signals.custom_style = 10; score += 10; }

  // Reference material (audio, image, document upload)
  if (inputs.referenceFile) { signals.reference_material = 15; score += 15; }

  // Persona / template / preset (saved creative identity)
  if (inputs.personaOrTemplate) { signals.persona_used = 10; score += 10; }

  // Iteration (remix / extension / edit of prior work)
  if (inputs.isIteration) { signals.iteration = 10; score += 10; }

  score = Math.min(100, score);
  return {
    score,
    signals,
    label: score >= 40 ? 'ai_assisted' : 'ai_generated',
    basis: buildBasisText(signals),
    ddex: mapTelemetryToDdex(inputs, score),
  };
}

// DDEX mapping — converts raw COS telemetry inputs into industry-accepted
// granular AI attribution attributes for downstream partner export.
export function mapTelemetryToDdex(inputs = {}, finalScore = 0) {
  return {
    ai_lyrical_content: !inputs.userProvidedContent,
    ai_composition: finalScore < 50 && !inputs.humanInstrumentPerformance,
    ai_instrumentation: !inputs.referenceFile && !inputs.humanInstrumentPerformance,
    ai_generated_vocals: !!inputs.personaOrTemplate && !!inputs.hasSyntheticVocals,
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
    ai_composition: score < 50,
    ai_instrumentation: !s.reference_material,
    ai_generated_vocals: !!s.persona_used,
    ai_post_production: asset.asset_type === 'master',
  };
}

function buildBasisText(signals) {
  const parts = [];
  if (signals.user_content)       parts.push('user-provided content');
  if (signals.detailed_prompt)    parts.push('detailed creative prompt');
  if (signals.basic_prompt)       parts.push('basic creative prompt');
  if (signals.custom_style)       parts.push('custom style/tags');
  if (signals.reference_material) parts.push('reference material upload');
  if (signals.persona_used)       parts.push('saved creative persona');
  if (signals.iteration)          parts.push('iterative refinement');
  return parts.length
    ? `Score based on: ${parts.join(', ')}.`
    : 'Fully AI-generated with minimal human direction.';
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
  "Every piece of AI-generated content on this platform carries a GenAI disclosure label aligned with the music community's voluntary labeling program (RIAA, IFPI & partners, July 2026). The Creative Ownership Score (0–100) reflects how much human creative input shaped each item — from the prompt depth and style customization to reference uploads and iterative refinement.";