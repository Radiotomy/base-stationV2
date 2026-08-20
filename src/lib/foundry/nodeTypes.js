// BASE Foundry — node type registry.
//
// This is the single source of truth for what a Foundry graph may contain: the
// canvas, the audio engine and the AI prompt schema all read from here, so a new
// module is added once rather than in three places that can drift apart.
//
// `params` declare range + default. `mod` marks a parameter a modulator may
// target (an LFO wired to a discrete choice like filter type is meaningless).

export const NODE_KINDS = {
  generator: { label: 'Generators', color: '#FF9A4D' },
  processor: { label: 'Processors', color: '#FFC26E' },
  modulator: { label: 'Modulators', color: '#FF6B4A' },
  io: { label: 'I/O', color: '#F5E5C7' },
};

export const NODE_DEFS = {
  oscillator: {
    label: 'Oscillator',
    kind: 'generator',
    audioIn: false,
    audioOut: true,
    params: {
      wave: { type: 'enum', options: ['sine', 'square', 'sawtooth', 'triangle'], default: 'sawtooth' },
      frequency: { type: 'number', min: 20, max: 4000, step: 1, default: 220, unit: 'Hz', mod: true },
      detune: { type: 'number', min: -1200, max: 1200, step: 1, default: 0, unit: 'ct', mod: true },
      level: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.5, mod: true },
    },
  },
  noise: {
    label: 'Noise',
    kind: 'generator',
    audioIn: false,
    audioOut: true,
    params: {
      color: { type: 'enum', options: ['white', 'pink'], default: 'white' },
      level: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.3, mod: true },
    },
  },
  sampler: {
    label: 'Sample Player',
    kind: 'generator',
    audioIn: false,
    audioOut: true,
    params: {
      url: { type: 'text', default: '' },
      loop: { type: 'bool', default: true },
      rate: { type: 'number', min: 0.25, max: 4, step: 0.01, default: 1, mod: true },
      level: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.8, mod: true },
    },
  },
  filter: {
    label: 'State Variable Filter',
    kind: 'processor',
    audioIn: true,
    audioOut: true,
    params: {
      mode: { type: 'enum', options: ['lowpass', 'highpass', 'bandpass'], default: 'lowpass' },
      cutoff: { type: 'number', min: 30, max: 18000, step: 10, default: 1200, unit: 'Hz', mod: true },
      resonance: { type: 'number', min: 0.1, max: 20, step: 0.1, default: 1.2, unit: 'Q', mod: true },
    },
  },
  delay: {
    label: 'Stereo Delay',
    kind: 'processor',
    audioIn: true,
    audioOut: true,
    params: {
      time: { type: 'number', min: 0.01, max: 2, step: 0.01, default: 0.28, unit: 's', mod: true },
      spread: { type: 'number', min: 0, max: 0.5, step: 0.005, default: 0.03, unit: 's' },
      feedback: { type: 'number', min: 0, max: 0.95, step: 0.01, default: 0.35, mod: true },
      mix: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.3, mod: true },
    },
  },
  reverb: {
    label: 'Reverb',
    kind: 'processor',
    audioIn: true,
    audioOut: true,
    params: {
      size: { type: 'number', min: 0.2, max: 6, step: 0.1, default: 2.2, unit: 's' },
      damping: { type: 'number', min: 0.5, max: 8, step: 0.1, default: 2.5 },
      mix: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.25, mod: true },
    },
  },
  saturation: {
    label: 'Saturation',
    kind: 'processor',
    audioIn: true,
    audioOut: true,
    params: {
      drive: { type: 'number', min: 1, max: 40, step: 0.5, default: 6, mod: true },
      tone: { type: 'number', min: 500, max: 16000, step: 100, default: 9000, unit: 'Hz', mod: true },
      output: { type: 'number', min: 0, max: 1.5, step: 0.01, default: 0.8, mod: true },
    },
  },
  eq3: {
    label: '3-Band EQ',
    kind: 'processor',
    audioIn: true,
    audioOut: true,
    params: {
      low: { type: 'number', min: -18, max: 18, step: 0.5, default: 0, unit: 'dB', mod: true },
      mid: { type: 'number', min: -18, max: 18, step: 0.5, default: 0, unit: 'dB', mod: true },
      mid_freq: { type: 'number', min: 200, max: 6000, step: 50, default: 1000, unit: 'Hz', mod: true },
      high: { type: 'number', min: -18, max: 18, step: 0.5, default: 0, unit: 'dB', mod: true },
    },
  },
  gain: {
    label: 'Gain',
    kind: 'processor',
    audioIn: true,
    audioOut: true,
    params: { level: { type: 'number', min: 0, max: 2, step: 0.01, default: 1, mod: true } },
  },
  lfo: {
    label: 'LFO (BPM sync)',
    kind: 'modulator',
    audioIn: false,
    audioOut: true,
    isModulator: true,
    params: {
      wave: { type: 'enum', options: ['sine', 'triangle', 'square', 'sawtooth'], default: 'sine' },
      sync: { type: 'bool', default: true },
      division: { type: 'enum', options: ['4', '2', '1', '1/2', '1/4', '1/8', '1/16'], default: '1/4' },
      rate: { type: 'number', min: 0.05, max: 20, step: 0.05, default: 2, unit: 'Hz' },
      depth: { type: 'number', min: 0, max: 4000, step: 1, default: 400 },
    },
  },
  adsr: {
    label: 'ADSR Envelope',
    kind: 'modulator',
    audioIn: false,
    audioOut: true,
    isModulator: true,
    params: {
      attack: { type: 'number', min: 0.001, max: 4, step: 0.001, default: 0.01, unit: 's' },
      decay: { type: 'number', min: 0.001, max: 4, step: 0.001, default: 0.2, unit: 's' },
      sustain: { type: 'number', min: 0, max: 1, step: 0.01, default: 0.6 },
      release: { type: 'number', min: 0.01, max: 6, step: 0.01, default: 0.4, unit: 's' },
      depth: { type: 'number', min: 0, max: 4000, step: 1, default: 1000 },
    },
  },
  input: {
    label: 'Insert Input',
    kind: 'io',
    audioIn: false,
    audioOut: true,
    params: {},
    hint: 'Audio being auditioned through this plugin (track preview or mic)',
  },
  output: {
    label: 'Output',
    kind: 'io',
    audioIn: true,
    audioOut: false,
    params: { level: { type: 'number', min: 0, max: 1.5, step: 0.01, default: 0.9 } },
  },
};

export function defaultParams(type) {
  const def = NODE_DEFS[type];
  if (!def) return {};
  const out = {};
  for (const [k, p] of Object.entries(def.params)) out[k] = p.default;
  return out;
}

export function modTargets(type) {
  const def = NODE_DEFS[type];
  if (!def) return [];
  return Object.entries(def.params).filter(([, p]) => p.mod).map(([k]) => k);
}

export function newId(prefix = 'n') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/** A minimal, always-audible starting graph so a new plugin is never a blank canvas. */
export function starterGraph() {
  const src = newId('in');
  const flt = newId('flt');
  const out = newId('out');
  return {
    nodes: [
      { id: src, type: 'input', x: 60, y: 140, params: defaultParams('input') },
      { id: flt, type: 'filter', x: 320, y: 130, params: defaultParams('filter') },
      { id: out, type: 'output', x: 600, y: 150, params: defaultParams('output') },
    ],
    edges: [
      { id: newId('e'), from: src, to: flt },
      { id: newId('e'), from: flt, to: out },
    ],
  };
}