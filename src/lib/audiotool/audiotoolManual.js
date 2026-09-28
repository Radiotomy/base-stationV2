// Audiotool's official device manual (audiotool.com/help), keyed by Nexus
// device type. Single source for Help entries, Explorer "Manual" links and the
// Bridge device allowlist. `bridge` notes how BASE Station uses the device;
// entries without it are recognised in the Session Explorer only.
const BASE = 'https://www.audiotool.com/help/manuals';
const p = (path) => `${BASE}/plugins/${path}.html`;

export const MANUAL_HOME = 'https://www.audiotool.com/help';
export const MANUAL_GUIDES = [
  { name: 'Basics', url: `${BASE}/get-started/basics.html`, summary: 'Desktop, timeline, cables and the Audiotool workflow.' },
  { name: 'Record Audio', url: `${BASE}/get-started/record-audio.html`, summary: 'Capture vocals and instruments via mic or line-in — pairs with the Vocal Lab.' },
  { name: 'Play & Record MIDI', url: `${BASE}/get-started/record-midi.html`, summary: 'Play notes from a hardware controller — regions you record count as human in the ownership meter.' },
  { name: 'Add Sounds', url: `${BASE}/get-started/add-sounds.html`, summary: 'Add instruments, drums and samples — Songstarter sends land here as audio tracks.' },
  { name: 'Automate', url: `${BASE}/get-started/automate.html`, summary: 'Parameter changes over time — the Bridge Automation Lanes write the same regions.' },
  { name: 'Design your Sound', url: `${BASE}/get-started/design-your-sound.html`, summary: 'Synths, effects and modulation — what Instrument Chain and Foundry Remote build on.' },
  { name: 'Mixer', url: `${BASE}/mixing/mixer.html`, summary: 'Channel strips, sends and master — every Bridge tool cables into a fresh mixer channel.' },
  { name: 'VST Bridge', url: `${BASE}/vst-bridge.html`, summary: 'Audiotool\'s desktop helper that hosts VST3 plugins. Install and open plugin windows in Audiotool; once the device is in a project, BASE Station lists it and can map its exposed knobs.' },
];

export const MANUAL_DEVICES = {
  // Synthesizers
  heisenberg: { name: 'Heisenberg', cat: 'Synthesizers', url: p('synthesizer/heisenberg'), summary: 'Wavetable/FM poly synth: bells, keys, digital pads.', bridge: 'Instrument Chain, Foundry Remote' },
  space: { name: 'Space', cat: 'Synthesizers', url: p('synthesizer/space'), summary: 'FM synth for lush pads and leads.', bridge: 'Instrument Chain, Foundry Remote' },
  pulverisateur: { name: 'Pulverisateur', cat: 'Synthesizers', url: p('synthesizer/pulverisateur'), summary: 'Virtual-analog monster synth: basses and aggressive leads.', bridge: 'Instrument Chain, Foundry Remote' },
  gakki: { name: 'Gakki', cat: 'Synthesizers', url: p('synthesizer/gakki'), summary: 'Soundfont instrument player: pianos, strings, orchestral.', bridge: 'Instrument Chain, Foundry Remote' },
  bassline: { name: 'Bassline', cat: 'Synthesizers', url: p('synthesizer/bassline'), summary: 'Monophonic acid bass with its own pattern sequencer.', bridge: 'Pattern Synths, Foundry Remote' },
  tonematrix: { name: 'ToneMatrix', cat: 'Synthesizers', url: p('synthesizer/tonematrix'), summary: '16×16 pixel step-sequencer synth.', bridge: 'Pattern Synths, Foundry Remote' },
  labs: { name: 'Spitfire LABS', cat: 'Synthesizers', url: p('synthesizer/labs'), summary: 'Sample-based instruments from Spitfire Audio.' },
  // Drums
  beatbox8: { name: 'Beatbox 8', cat: 'Drums', url: p('drums/beatbox8'), summary: 'Classic 808-style drum machine with pattern slots.', bridge: 'Drum Machine, Foundry Remote' },
  beatbox9: { name: 'Beatbox 9', cat: 'Drums', url: p('drums/beatbox9'), summary: '909-style analog drums.' },
  machiniste: { name: 'Machiniste', cat: 'Drums', url: p('drums/machiniste'), summary: 'Drum sampler — load your own hits per pad.' },
  // Effects
  autoFilter: { name: 'Autofilter', cat: 'Effects', url: p('effects/autofilter'), summary: 'Dynamic, envelope/LFO driven filter.' },
  curve: { name: 'Curve', cat: 'Effects', url: p('effects/curve'), summary: 'Graphic curve EQ.' },
  exciter: { name: 'Exciter', cat: 'Effects', url: p('effects/exciter'), summary: 'Adds harmonics for brightness and presence.' },
  gravity: { name: 'Gravity', cat: 'Effects', url: p('effects/gravity'), summary: 'Compressor.' },
  helmholtz: { name: 'Helmholtz', cat: 'Effects', url: p('effects/helmholtz'), summary: 'Tuned resonator.' },
  orbit: { name: 'Orbit', cat: 'Effects', url: p('effects/orbit'), summary: 'EQ.' },
  panorama: { name: 'Panorama', cat: 'Effects', url: p('effects/panorama'), summary: 'Stereo panning and width.' },
  pulsar: { name: 'Pulsar', cat: 'Effects', url: p('effects/pulsar'), summary: 'Delay.' },
  quantum: { name: 'Quantum', cat: 'Effects', url: p('effects/quantum'), summary: 'Multiband compressor.' },
  quasar: { name: 'Quasar', cat: 'Effects', url: p('effects/quasar'), summary: 'Reverb.' },
  rasselbock: { name: 'Rasselbock', cat: 'Effects', url: p('effects/rasselbock'), summary: 'Bitcrusher / glitch effect.' },
  ringModulator: { name: 'Ring Modulator', cat: 'Effects', url: p('effects/ringmodulator'), summary: 'Metallic ring modulation.' },
  stereoEnhancer: { name: 'Stereo Enhancer', cat: 'Effects', url: p('effects/stereoenhancer'), summary: 'Widens the stereo image.' },
  waveshaper: { name: 'Wave Shaper', cat: 'Effects', url: p('effects/waveshaper'), summary: 'Distortion by transfer curve.' },
  graphicalEQ: { name: 'Graphical EQ', cat: 'Effects', url: p('effects/parametriceq'), summary: 'Multi-band EQ.' },
  stompboxChorus: { name: 'Chorus', cat: 'Effects', url: p('effects/chorus'), summary: 'Stompbox chorus.' },
  stompboxCompressor: { name: 'Compressor', cat: 'Effects', url: p('effects/compressor'), summary: 'Stompbox compressor.' },
  stompboxCrusher: { name: 'Crusher', cat: 'Effects', url: p('effects/crusher'), summary: 'Stompbox bitcrusher.' },
  stompboxDelay: { name: 'Delay', cat: 'Effects', url: p('effects/delay'), summary: 'Stompbox delay.' },
  stompboxParametricEqualizer: { name: 'Parametric EQ', cat: 'Effects', url: p('effects/parametriceq'), summary: 'Stompbox parametric EQ.' },
  stompboxFlanger: { name: 'Flanger', cat: 'Effects', url: p('effects/flanger'), summary: 'Stompbox flanger.' },
  stompboxGate: { name: 'Gate', cat: 'Effects', url: p('effects/gate'), summary: 'Noise gate.' },
  stompboxPhaser: { name: 'Phaser', cat: 'Effects', url: p('effects/phaser'), summary: 'Stompbox phaser.' },
  stompboxPitchDelay: { name: 'Pitch Delay', cat: 'Effects', url: p('effects/pitchdelay'), summary: 'Pitch-shifting delay.' },
  stompboxReverb: { name: 'Reverb', cat: 'Effects', url: p('effects/reverb'), summary: 'Stompbox reverb.' },
  stompboxSlope: { name: 'Slope', cat: 'Effects', url: p('effects/slope'), summary: 'Filter.' },
  stompboxStereoDetune: { name: 'Stereo Detune', cat: 'Effects', url: p('effects/stereodetune'), summary: 'Detuned stereo thickening.' },
  stompboxTube: { name: 'Tube', cat: 'Effects', url: p('effects/tube'), summary: 'Tube-style saturation.' },
  // Tools & mixers
  bandSplitter: { name: 'Band Splitter', cat: 'Tools', url: p('tools/bandsplitter'), summary: 'Splits audio into frequency bands.' },
  audioMerger: { name: 'Merger', cat: 'Tools', url: p('tools/merger'), summary: 'Combines signals.' },
  audioSplitter: { name: 'Splitter', cat: 'Tools', url: p('tools/splitter'), summary: 'Duplicates a signal to several outputs.' },
  tinyGain: { name: 'Tiny Gain', cat: 'Tools', url: p('tools/tinygain'), summary: 'Simple level control.' },
  matrixArpeggiator: { name: 'Matrix Arpeggiator', cat: 'Tools', url: p('tools/matrixarpeggiator'), summary: 'MIDI arpeggiator.' },
  noteSplitter: { name: 'Note Splitter', cat: 'Tools', url: p('tools/notesplitter'), summary: 'Routes notes to different instruments.' },
  centroid: { name: 'Centroid', cat: 'Tools', url: p('tools/centroid'), summary: 'Compact mixer.' },
  crossfader: { name: 'Crossfader', cat: 'Tools', url: p('tools/crossfader'), summary: 'DJ-style A/B crossfade.' },
  kobolt: { name: 'Kobolt', cat: 'Tools', url: p('tools/kobolt'), summary: 'Mixer.' },
  minimixer: { name: 'MiniMixer', cat: 'Tools', url: p('tools/minimixer'), summary: 'Small mixer.' },
  // Plugin host
  vstBridge: { name: 'VST Bridge', cat: 'Tools', url: `${BASE}/vst-bridge.html`, summary: 'Hosts a VST3 plugin running on your computer via the Audiotool desktop helper.' },
};

export const manualFor = (type) => MANUAL_DEVICES[type] || null;
export const MANUAL_DEVICE_TYPES = Object.keys(MANUAL_DEVICES);