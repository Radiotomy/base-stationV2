/**
 * Offline Mastering Renderer
 *
 * Mirrors the live DSP graph in `hooks/useMasteringChain.js` but uses
 * OfflineAudioContext + AudioBufferSourceNode, so the entire signal path
 * (Balance → Mid/Side → 5-Band EQ → Saturator → Sub Shelf → Radio →
 * Reverb → Compressor → LUFS makeup) is RENDERED into a new AudioBuffer.
 *
 * Returns: AudioBuffer of the processed audio.
 */

const makeSaturationCurve = (amount /* 0..1 */) => {
  const k = amount * 100;
  const n = 1024;
  const curve = new Float32Array(n);
  const deg = Math.PI / 180;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
};

const makeImpulse = (ctx, durationSec = 2.2, decay = 2.0) => {
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(rate * durationSec));
  const impulse = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
};

/**
 * Fetch + decode audio from a URL into an AudioBuffer.
 */
export async function decodeAudioFromUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch audio: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  // Use a temporary online context just to decode
  const tmpCtx = new (window.AudioContext || window.webkitAudioContext)();
  const decoded = await tmpCtx.decodeAudioData(arrayBuffer);
  tmpCtx.close().catch(() => {});
  return decoded;
}

/**
 * Render mastering offline.
 *
 * @param {AudioBuffer} sourceBuffer - decoded source audio
 * @param {Object} settings
 *   - character: { radio, destroy, heaven_low, space, master_punch }   each 0..100
 *   - eq:        { low, lowMid, mid, highMid, high }                   each -12..+12 dB
 *   - lufsTarget: -20..-6
 *   - stereo:    { balance: -100..100, separation: -100..100 }
 * @returns {Promise<AudioBuffer>}
 */
export async function renderMasteringOffline(sourceBuffer, settings) {
  const { character = {}, eq = {}, lufsTarget = -14, stereo = {} } = settings;
  const { balance = 0, separation = 0 } = stereo;

  // Force stereo: if source is mono, duplicate the channel so the
  // Mid/Side + L/R balance graph has 2 channels to work with.
  const numChannels = 2;
  const sampleRate = sourceBuffer.sampleRate;
  const length = sourceBuffer.length;

  const ctx = new OfflineAudioContext({
    numberOfChannels: numChannels,
    length,
    sampleRate,
  });

  // Build a stereo input buffer
  const stereoBuf = ctx.createBuffer(2, length, sampleRate);
  if (sourceBuffer.numberOfChannels === 1) {
    const mono = sourceBuffer.getChannelData(0);
    stereoBuf.copyToChannel(mono, 0);
    stereoBuf.copyToChannel(mono, 1);
  } else {
    stereoBuf.copyToChannel(sourceBuffer.getChannelData(0), 0);
    stereoBuf.copyToChannel(sourceBuffer.getChannelData(1), 1);
  }

  const source = ctx.createBufferSource();
  source.buffer = stereoBuf;

  // ─── Balance (L/R Gain via equal-power pan) ───
  const splitIn = ctx.createChannelSplitter(2);
  const lGain   = ctx.createGain();
  const rGain   = ctx.createGain();
  const merger  = ctx.createChannelMerger(2);
  {
    const b = balance / 100;
    const lPan = Math.cos((b + 1) * Math.PI / 4);
    const rPan = Math.sin((b + 1) * Math.PI / 4);
    const norm = 1 / Math.cos(Math.PI / 4);
    lGain.gain.value = lPan * norm;
    rGain.gain.value = rPan * norm;
  }
  source.connect(splitIn);
  splitIn.connect(lGain, 0);
  splitIn.connect(rGain, 1);
  lGain.connect(merger, 0, 0);
  rGain.connect(merger, 0, 1);

  // ─── Mid/Side Separation ───
  const msSplit  = ctx.createChannelSplitter(2);
  const midSumL  = ctx.createGain(); midSumL.gain.value = 0.5;
  const midSumR  = ctx.createGain(); midSumR.gain.value = 0.5;
  const sideSumL = ctx.createGain(); sideSumL.gain.value = 0.5;
  const sideSumR = ctx.createGain(); sideSumR.gain.value = -0.5;
  const midGain  = ctx.createGain();
  const sideGain = ctx.createGain();
  const msMerge  = ctx.createChannelMerger(2);
  midGain.gain.value  = 1;
  sideGain.gain.value = Math.max(0, 1 + separation / 100); // -100→0, 0→1, +100→2

  merger.connect(msSplit);
  msSplit.connect(midSumL, 0);
  msSplit.connect(midSumR, 1);
  msSplit.connect(sideSumL, 0);
  msSplit.connect(sideSumR, 1);
  midSumL.connect(midGain);
  midSumR.connect(midGain);
  sideSumL.connect(sideGain);
  sideSumR.connect(sideGain);
  const sideInv = ctx.createGain(); sideInv.gain.value = -1;
  midGain.connect(msMerge, 0, 0);
  midGain.connect(msMerge, 0, 1);
  sideGain.connect(msMerge, 0, 0);
  sideGain.connect(sideInv);
  sideInv.connect(msMerge, 0, 1);

  // ─── 5-Band Peaking EQ ───
  const bands = [
    { key: 'low',     freq: 60,    Q: 0.9 },
    { key: 'lowMid',  freq: 250,   Q: 1.0 },
    { key: 'mid',     freq: 1000,  Q: 1.0 },
    { key: 'highMid', freq: 4000,  Q: 1.0 },
    { key: 'high',    freq: 12000, Q: 0.9 },
  ];
  let cursor = msMerge;
  bands.forEach(b => {
    const f = ctx.createBiquadFilter();
    f.type = 'peaking';
    f.frequency.value = b.freq;
    f.Q.value = b.Q;
    f.gain.value = eq[b.key] ?? 0;
    cursor.connect(f);
    cursor = f;
  });

  // ─── Character: Saturator (destroy) ───
  const destroyV = Math.max(0, Math.min(100, character.destroy ?? 0)) / 100;
  const saturator = ctx.createWaveShaper();
  saturator.curve = makeSaturationCurve(destroyV);
  saturator.oversample = '4x';
  cursor.connect(saturator);
  cursor = saturator;

  // ─── Character: Sub low-shelf (heaven_low) ───
  const heavenV = Math.max(0, Math.min(100, character.heaven_low ?? 0)) / 100;
  const subShelf = ctx.createBiquadFilter();
  subShelf.type = 'lowshelf';
  subShelf.frequency.value = 90;
  subShelf.gain.value = heavenV * 12;
  cursor.connect(subShelf);
  cursor = subShelf;

  // ─── Character: Radio (telephone-band wet/dry) ───
  const radioV = Math.max(0, Math.min(100, character.radio ?? 0)) / 100;
  const radioDry    = ctx.createGain(); radioDry.gain.value = 1 - radioV * 0.85;
  const radioWet    = ctx.createGain(); radioWet.gain.value = radioV;
  const radioHPF    = ctx.createBiquadFilter(); radioHPF.type = 'highpass'; radioHPF.frequency.value = 500;
  const radioLPF    = ctx.createBiquadFilter(); radioLPF.type = 'lowpass';  radioLPF.frequency.value = 3000;
  const radioMerger = ctx.createGain();
  cursor.connect(radioDry);
  cursor.connect(radioHPF);
  radioHPF.connect(radioLPF);
  radioLPF.connect(radioWet);
  radioDry.connect(radioMerger);
  radioWet.connect(radioMerger);
  cursor = radioMerger;

  // ─── Character: Reverb (space) ───
  const spaceV = Math.max(0, Math.min(100, character.space ?? 0)) / 100;
  const reverbDry    = ctx.createGain(); reverbDry.gain.value = 1 - spaceV * 0.3;
  const reverbWet    = ctx.createGain(); reverbWet.gain.value = spaceV * 0.4;
  const reverbConv   = ctx.createConvolver();
  reverbConv.buffer  = makeImpulse(ctx, 2.2, 2.0);
  const reverbMerger = ctx.createGain();
  cursor.connect(reverbDry);
  cursor.connect(reverbConv);
  reverbConv.connect(reverbWet);
  reverbDry.connect(reverbMerger);
  reverbWet.connect(reverbMerger);
  cursor = reverbMerger;

  // ─── Character: Compressor (master_punch) ───
  const punchV = Math.max(0, Math.min(100, character.master_punch ?? 0)) / 100;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -10 - punchV * 18;
  comp.ratio.value     = 1.5 + punchV * 4.5;
  comp.knee.value      = 12;
  comp.attack.value    = 0.01;
  comp.release.value   = 0.18;
  cursor.connect(comp);
  cursor = comp;

  // ─── Master makeup: punch + LUFS target ───
  const master = ctx.createGain();
  const punchMakeup = 1 + punchV * 0.6;
  const lufsDb      = (-14 - lufsTarget) * -1;       // -14→0, -8→+6, -20→-6
  const lufsLinear  = Math.pow(10, lufsDb / 20);
  master.gain.value = punchMakeup * lufsLinear;
  cursor.connect(master);
  master.connect(ctx.destination);

  source.start(0);
  const rendered = await ctx.startRendering();
  return rendered;
}