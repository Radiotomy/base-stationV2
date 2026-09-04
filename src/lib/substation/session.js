// SUB-Station session state: shape, demo session, localStorage persistence.
// Persistence is deliberately local (PRD §4) — an arrangement in progress is a
// scratch document, and only the bounce + manifest are handed to BASE Station.
const KEY = 'substation.session.v2';
const ONBOARD_KEY = 'substation.onboarded.v2';

export const TRACK_COLORS = ['#14b8a6', '#FF9A4D', '#f59e0b', '#38bdf8', '#a78bfa', '#fb7185'];

export const SNAP_OPTIONS = [
  { id: 'off', label: 'Off', beats: 0 },
  { id: '1/4', label: '1/4', beats: 1 },
  { id: '1/8', label: '1/8', beats: 0.5 },
  { id: '1/16', label: '1/16', beats: 0.25 },
];

export const uid = (p = 'x') => `${p}_${Math.random().toString(36).slice(2, 9)}`;

export function newTrack(kind = 'synth', index = 0) {
  return {
    id: uid('trk'),
    name: kind === 'aux' ? `Aux ${index + 1}` : kind === 'audio' ? `Audio ${index + 1}` : `Synth ${index + 1}`,
    kind,
    color: TRACK_COLORS[index % TRACK_COLORS.length],
    volume: 0.8,
    pan: 0,
    mute: false,
    solo: false,
    arm: false,
    output: 'master',
    patch: null,
    clips: [],
    automation: [],
  };
}

export function defaultFx() {
  return {
    eq: { low: 0, mid: 0, high: 0, midFreq: 1000 },
    delay: { time: 0.32, feedback: 0.28, mix: 0.15 },
    reverb: { size: 2.2, mix: 0.18 },
    comp: { threshold: -22, ratio: 3.5, attack: 0.01, release: 0.22 },
    limiter: { ceiling: -1.2 },
  };
}

export function emptySession() {
  return {
    name: 'Untitled Arrangement',
    bpm: 96,
    snap: '1/8',
    zoom: 34,
    loop: { enabled: false, start: 0, end: 16 },
    metronome: false,
    tracks: [newTrack('synth', 0), newTrack('audio', 1)],
    fx: defaultFx(),
    splits: [{ id: uid('sp'), name: '', role: 'Writer', pct: 100 }],
    meta: { title: '', genre: '', ai_label: 'ai_assisted' },
  };
}

// The demo arrangement is a REAL recording, rendered on Cadence from an authored
// A-minor progression (Am F C G ×2 · Dm G Em Am · F G Am) at 96 BPM — 16 bars, 40s.
// The previous demo was built from single-pitch synth clips, which is a test tone
// repeating rather than music: nothing about it read as a part to a listener.
const DEMO_BED_URL = 'https://base44.app/api/apps/69f37db5a0cc60c31a7afc80/files/mp/public/69f37db5a0cc60c31a7afc80/a5376378c_substation-demo-bed.wav';

// Bar-by-bar roots of that same progression, so the demo bass PLAYS the bed's
// harmony instead of droning against it. One chord per bar, 4 beats each.
const DEMO_BASS_ROOTS = [
  110.00, 87.31, 130.81, 98.00,   // Am  F  C  G
  110.00, 87.31, 130.81, 98.00,   // Am  F  C  G
  73.42,  98.00, 82.41,  110.00,  // Dm  G  Em Am
  87.31,  98.00, 110.00, 110.00,  // F   G  Am Am
];

export function demoSession() {
  const s = emptySession();
  s.name = 'Demo Arrangement';
  s.tracks = [newTrack('audio', 0), newTrack('synth', 1), newTrack('audio', 2), newTrack('aux', 3)];
  s.tracks[0].name = 'Cadence Bed';
  s.tracks[0].clips = [
    { id: uid('c'), name: 'Neo-Soul Bed', kind: 'audio', start: 0, length: 64, url: DEMO_BED_URL, offset: 0, gain: 1 },
  ];
  s.tracks[1].name = 'Bass';
  s.tracks[1].pan = -0.15;
  s.tracks[1].volume = 0.5; // sits under the bed rather than fighting it
  s.tracks[1].clips = DEMO_BASS_ROOTS.map((pitch, bar) => ({
    id: uid('c'), name: 'Bass', kind: 'synth', start: bar * 4, length: 4, pitch, step: 1, gain: 0.8,
  }));
  s.tracks[2].name = 'Stem Slot';
  s.tracks[3].name = 'Reverb Bus';
  s.loop = { enabled: false, start: 0, end: 64 };
  s.splits = [
    { id: uid('sp'), name: 'You', role: 'Writer', pct: 60 },
    { id: uid('sp'), name: 'Collaborator', role: 'Producer', pct: 40 },
  ];
  s.meta.title = 'Demo Arrangement';
  return s;
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.tracks) return null;
    return { ...emptySession(), ...parsed, fx: { ...defaultFx(), ...(parsed.fx || {}) } };
  } catch {
    return null;
  }
}

export function saveSession(session) {
  try { localStorage.setItem(KEY, JSON.stringify(session)); } catch { /* quota — session simply isn't persisted */ }
}

export const hasOnboarded = () => { try { return localStorage.getItem(ONBOARD_KEY) === '1'; } catch { return false; } };
export const markOnboarded = () => { try { localStorage.setItem(ONBOARD_KEY, '1'); } catch { /* ignore */ } };

export const snapBeats = (snapId) => SNAP_OPTIONS.find(o => o.id === snapId)?.beats ?? 0;

export function quantize(beat, snapId) {
  const q = snapBeats(snapId);
  if (!q) return Math.max(0, beat);
  return Math.max(0, Math.round(beat / q) * q);
}

export const barsBeats = (beat) => {
  const b = Math.max(0, beat);
  const bar = Math.floor(b / 4) + 1;
  const beatIn = Math.floor(b % 4) + 1;
  const tick = Math.floor((b % 1) * 96).toString().padStart(2, '0');
  return `${bar}.${beatIn}.${tick}`;
};

export const timecode = (beat, bpm) => {
  const sec = Math.max(0, (beat * 60) / bpm);
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  const ms = Math.floor((sec % 1) * 100).toString().padStart(2, '0');
  return `${m}:${s}.${ms}`;
};