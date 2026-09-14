/**
 * BASE Station credit prices for Sonic operations — matched 1:1 to the upstream
 * aimusicapi.ai Credits Usage Guide (audit 2026-09-03), by the owner's decision.
 *
 * v6 update (2026-09-09): no price change — v6 costs exactly what the models it
 * replaces cost. Every live model is now a v6 variant, and v6 is the successor of
 * the advanced tier (v4.5 → v5.5), so generation is 14 in both custom-lyrics and
 * description mode. Legacy ids are rendered by v6 upstream and are priced as v6.
 * Every generation still returns two takes.
 */
import { SONIC_MODELS } from './sonicModels.ts';

export const SONIC_ADVANCED_MODELS = new Set(Object.keys(SONIC_MODELS));

export function sonicGenerationCost(_model: string, _customMode: boolean): number {
  // Every id resolves to a v6 variant, and v6 sits on the advanced tier.
  return 14;
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