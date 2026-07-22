// COS Engine 2.0 — backend mirror of the signal registry
// (frontend source of truth: src/utils/participationScore.js)
export const COS_ENGINE_VERSION = '2.0';

export const SIGNAL_REGISTRY = {
  user_content:        { points: 35, dimension: 'content_authorship' },
  deep_prompt:         { points: 18, dimension: 'creative_direction' },
  detailed_prompt:     { points: 14, dimension: 'creative_direction' },
  basic_prompt:        { points: 7,  dimension: 'creative_direction' },
  musical_specificity: { points: 6,  dimension: 'creative_direction' },
  custom_style:        { points: 6,  dimension: 'sonic_identity' },
  rich_style:          { points: 4,  dimension: 'sonic_identity' },
  reference_material:  { points: 12, dimension: 'sonic_identity' },
  persona_used:        { points: 9,  dimension: 'vocal_identity' },
  iteration:           { points: 8,  dimension: 'craft_refinement' },
  human_performance:   { points: 12, dimension: 'craft_refinement' },
};

export const DIMENSION_LABELS = {
  content_authorship: 'Content Authorship',
  creative_direction: 'Creative Direction',
  sonic_identity: 'Sonic Identity',
  vocal_identity: 'Vocal Identity',
  craft_refinement: 'Craft & Refinement',
};

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