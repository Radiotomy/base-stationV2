// One map for the faint family accents used across the Audiotool surfaces
// (Session Explorer, workspaces, Songstarter). Families come straight from the
// Nexus entity type string, so no extra API data is needed.
import { CHAIN_INSTRUMENTS } from '@/lib/audiotool/instrumentChain';

export const FAMILIES = {
  instrument: { color: '#c9a0ff', wash: 'rgba(201,160,255,.075)', label: 'Instrument' },
  effect: { color: '#6fd3c7', wash: 'rgba(111,211,199,.07)', label: 'Effect' },
  eq: { color: '#e5bd75', wash: 'rgba(229,189,117,.07)', label: 'EQ & filter' },
  mixer: { color: '#8eb5d8', wash: 'rgba(142,181,216,.07)', label: 'Mixer' },
  pattern: { color: '#ff9a7a', wash: 'rgba(255,154,122,.07)', label: 'Pattern' },
  sample: { color: '#b8d98f', wash: 'rgba(184,217,143,.07)', label: 'Audio' },
  utility: { color: '#a9a097', wash: 'rgba(169,160,151,.06)', label: 'Utility' },
};

// Marker for material an AI tool created (from COS telemetry).
export const AI_ORIGIN_COLOR = '#ffb36b';

const INSTRUMENTS = new Set([...CHAIN_INSTRUMENTS, 'machiniste', 'kobolt', 'rasselbock']);
const PATTERN_DEVICES = new Set(['beatbox8', 'beatbox9', 'bassline', 'tonematrix']);
const EQ = new Set(['graphicalEQ', 'stompboxParametricEqualizer', 'stompboxSlope', 'autoFilter', 'curve', 'helmholtz']);
const UTILITY = new Set(['tinyGain', 'panorama', 'centroid', 'minimixer', 'audioSplitter', 'audioMerger']);

export function deviceFamily(type = '') {
  if (INSTRUMENTS.has(type)) return 'instrument';
  if (PATTERN_DEVICES.has(type)) return 'pattern';
  if (type === 'audioDevice') return 'sample';
  if (EQ.has(type)) return 'eq';
  if (/mixer/i.test(type)) return 'mixer';
  if (UTILITY.has(type)) return 'utility';
  return 'effect';
}

const TRACK_KINDS = { MIDI: 'instrument', Audio: 'sample', Automation: 'eq', Pattern: 'pattern' };
export const trackFamily = (kind) => TRACK_KINDS[kind] || 'utility';

const REGION_TYPES = { noteRegion: 'instrument', audioRegion: 'sample', automationRegion: 'eq', patternRegion: 'pattern' };
export const regionFamily = (type) => REGION_TYPES[type] || 'utility';

/** CSS variables consumed by the .at-family-row scoped styles. */
export const familyVars = (family) => ({
  '--family': FAMILIES[family]?.color || FAMILIES.utility.color,
  '--wash': FAMILIES[family]?.wash || FAMILIES.utility.wash,
});