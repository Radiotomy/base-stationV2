/**
 * BASE Station credit prices for Sonic operations — matched 1:1 to the upstream
 * aimusicapi.ai Credits Usage Guide (audit 2026-09-03), by the owner's decision.
 *
 * Generation: advanced models (v4.5, v4.5+, v5, v5.5) and description mode
 * (custom_mode=false on any model) cost 14; v3.5 / v4 with custom lyrics cost 10.
 * Every generation still returns two takes.
 */
export const SONIC_ADVANCED_MODELS = new Set(['sonic-v4-5', 'sonic-v4-5-plus', 'sonic-v5', 'sonic-v5-5']);

export function sonicGenerationCost(model: string, customMode: boolean): number {
  return (SONIC_ADVANCED_MODELS.has(model) || !customMode) ? 14 : 10;
}

export const SONIC_COSTS = {
  extend: 10,
  remaster: 10,
  replace_section: 10,
  add_vocals: 10,
  add_instrumental: 10,
  concat: 2,
  upload: 2,          // added when a source must first be uploaded to Sonic
  stems_basic: 20,    // vocal + instrumental
  stems_full: 50,     // 12-track split
  // Lossless / multi-format delivery via POST /sonic/download. Audit 2026-09-04:
  // this replaced the legacy 1-credit /sonic/wav and costs 2 per CALL regardless
  // of how many formats are asked for, so mp3 + wav + m4a are always requested
  // together rather than one call per format. A 202 ("preparing") is free.
  download: 2,
};