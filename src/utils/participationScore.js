// ─────────────────────────────────────────────────────────────────
// COS ENGINE 2.0 — client interface
//
// Score CALCULATION is performed server-side by the authoritative
// COS engine (backend `calculateCos` function). This module keeps:
//   • the community-published signal registry (governance-tuned
//     baseline weights, publicly debated on /governance)
//   • display helpers (tiers, dimension roll-ups over STORED data)
// The scoring heuristics themselves never ship to the browser.
// ─────────────────────────────────────────────────────────────────
import { base44 } from '@/api/base44Client';

export const COS_ENGINE_VERSION = '2.0';

// Signal registry — community-published baseline weights and labels,
// used for DISPLAY of stored scores. The authoritative copy lives server-side.
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

/**
 * Authoritative Creative Ownership Score — computed on BASE Station's servers.
 * Sends raw creative-process telemetry to the backend COS engine and returns
 * { engine, score, signals, dimensions, confidence, label, basis, ddex }.
 * NOTE: async — callers must await.
 */
export async function calculateHumanParticipationScore(inputs = {}) {
  const res = await base44.functions.invoke('calculateCos', inputs);
  return res.data;
}

// Roll a flat signal map (stored on any asset, v1 or v2) up into the
// five creative dimensions — each 0–100% of that dimension's ceiling.
// Display-only: operates on already-stored data.
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