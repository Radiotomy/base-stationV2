/**
 * Parametric EQ — 7 Critical Mastering Frequency Zones
 *
 * Single source of truth used by BOTH:
 *   - hooks/useMasteringChain.js   (real-time preview graph)
 *   - utils/offlineMastering.js    (offline render for the final WAV)
 * Keeping them on one list guarantees preview === render.
 *
 * type: BiquadFilter type. Shelves for the outer zones (broad tone-shaping),
 * peaking with tuned Q for the inner surgical zones.
 */
export const PARAMETRIC_EQ_ZONES = [
  { key: 'sub',      label: 'Sub',      hz: '<40Hz',    desc: 'Cleanup · cut mud, restore headroom', type: 'lowshelf',  freq: 40,    q: 0.7 },
  { key: 'lowBass',  label: 'Low Bass', hz: '50–60Hz',  desc: 'Kick thump & bassline depth',         type: 'peaking',   freq: 55,    q: 1.1 },
  { key: 'punch',    label: 'Punch',    hz: '100–200Hz', desc: 'Warmth & chest punch',               type: 'peaking',   freq: 150,   q: 1.0 },
  { key: 'mud',      label: 'Mud',      hz: '200–500Hz', desc: 'Boxiness · wide gentle cuts clear vocals', type: 'peaking', freq: 350, q: 0.7 },
  { key: 'body',     label: 'Body',     hz: '500–1kHz', desc: 'Instrument tone & body',              type: 'peaking',   freq: 750,   q: 1.0 },
  { key: 'presence', label: 'Presence', hz: '2–5kHz',   desc: 'Vocal bite · boost edge, cut harshness', type: 'peaking', freq: 3200,  q: 1.0 },
  { key: 'air',      label: 'Air',      hz: '10–16kHz', desc: 'Sparkle & premium space',             type: 'highshelf', freq: 11000, q: 0.7 },
];

export const DEFAULT_PARAMETRIC_EQ = Object.fromEntries(
  PARAMETRIC_EQ_ZONES.map(z => [z.key, 0])
);

/**
 * ─── BACKUP / ROLLBACK ───
 * The previous 5-band graphic EQ, preserved verbatim. To revert, swap
 * PARAMETRIC_EQ_ZONES for LEGACY_EQ_BANDS_5 in the three consumer files
 * (useMasteringChain.js, offlineMastering.js, AIMasteringPanel.jsx).
 * Legacy keys (low, lowMid, mid, highMid, high) in old saved settings are
 * simply ignored by the new engine — nothing crashes.
 */
export const LEGACY_EQ_BANDS_5 = [
  { key: 'low',     label: 'Low',      hz: '60Hz',  type: 'peaking', freq: 60,    q: 0.9 },
  { key: 'lowMid',  label: 'Low Mid',  hz: '250Hz', type: 'peaking', freq: 250,   q: 1.0 },
  { key: 'mid',     label: 'Mid',      hz: '1kHz',  type: 'peaking', freq: 1000,  q: 1.0 },
  { key: 'highMid', label: 'High Mid', hz: '4kHz',  type: 'peaking', freq: 4000,  q: 1.0 },
  { key: 'high',    label: 'High',     hz: '12kHz', type: 'peaking', freq: 12000, q: 0.9 },
];