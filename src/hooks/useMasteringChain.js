import { useRef, useCallback, useEffect, useMemo } from 'react';
import { PARAMETRIC_EQ_ZONES } from '@/config/parametricEQZones';
import { buildFoundryInsert, isInsertable } from '@/lib/foundry/foundryInsert';

/**
 * useMasteringChain
 * Builds a real-time Web Audio processing chain for the AI Mastering preview.
 *
 * Signal path:
 *   source
 *     → splitter(L,R) → lGain / rGain → merger      (Balance)
 *     → midSideMatrix (cross-feed)                  (Separation: mono ↔ wide)
 *     → 5x BiquadFilter (peaking)                   (5-Band EQ)
 *     → WaveShaper                                  (Character: destroy = saturation)
 *     → lowShelfBoost                               (Character: heaven_low = sub)
 *     → telephoneBand (mid-only HPF+LPF wet/dry)    (Character: radio = telephone band)
 *     → ConvolverNode (impulse)                     (Character: space = reverb)
 *     → DynamicsCompressorNode                      (Character: master_punch + lufs target)
 *     → masterGain (LUFS makeup)
 *     → analyserSplitter → lAnalyser / rAnalyser
 *     → destination
 *
 * Returns:
 *   - attach(source, ctx): build the graph onto an incoming MediaElementSourceNode
 *   - setBalance(-100..100)
 *   - setSeparation(-100..100)
 *   - setEQBand(key, dB)         keys: low, lowMid, mid, highMid, high
 *   - setCharacter(key, 0..100)  keys: radio, destroy, heaven_low, space, master_punch
 *   - setLufsTarget(lufs)        -20..-6 — drives master makeup gain
 *   - getAnalysers(): { left, right }
 */
export default function useMasteringChain() {
  const ctxRef         = useRef(null);
  const sourceRef      = useRef(null);
  // Balance
  const splitInRef     = useRef(null);
  const lGainRef       = useRef(null);
  const rGainRef       = useRef(null);
  const mergerRef      = useRef(null);
  // Separation (Mid/Side)
  const msSplitRef     = useRef(null);
  const midSumLRef     = useRef(null);
  const midSumRRef     = useRef(null);
  const sideSumLRef    = useRef(null);
  const sideSumRRef    = useRef(null);
  const midGainRef     = useRef(null);
  const sideGainRef    = useRef(null);
  const msMergeRef     = useRef(null);
  // EQ
  const eqNodesRef     = useRef({});      // { low, lowMid, mid, highMid, high }
  // Character
  const saturatorRef   = useRef(null);
  const subShelfRef    = useRef(null);
  const radioWetRef    = useRef(null);    // gain wet
  const radioDryRef    = useRef(null);    // gain dry
  const radioHPFRef    = useRef(null);
  const radioLPFRef    = useRef(null);
  const radioMergerRef = useRef(null);
  const reverbWetRef   = useRef(null);
  const reverbDryRef   = useRef(null);
  const reverbConvRef  = useRef(null);
  const reverbMergerRef= useRef(null);
  const compRef        = useRef(null);
  // Master + meter
  const masterGainRef  = useRef(null);
  const insertRef      = useRef(null);   // active Foundry insert, if any
  const meterSplitRef  = useRef(null);
  const lAnalyserRef   = useRef(null);
  const rAnalyserRef   = useRef(null);

  // ─── Build a soft-clipping waveshaper curve (saturation) ─────────────────
  const makeSaturationCurve = (amount) => {
    // amount: 0..1
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

  // ─── Build a small impulse response for the reverb convolver ─────────────
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

  const safeDisconnect = (node) => { try { node?.disconnect(); } catch {} };

  /**
   * Build/rebuild the processing graph onto the given source + context.
   */
  const attach = useCallback((source, ctx) => {
    if (!source || !ctx) return;
    ctxRef.current = ctx;

    // Disconnect any previous graph nodes (source itself stays alive)
    [
      sourceRef, splitInRef, lGainRef, rGainRef, mergerRef,
      msSplitRef, midSumLRef, midSumRRef, sideSumLRef, sideSumRRef,
      midGainRef, sideGainRef, msMergeRef,
      saturatorRef, subShelfRef,
      radioWetRef, radioDryRef, radioHPFRef, radioLPFRef, radioMergerRef,
      reverbWetRef, reverbDryRef, reverbConvRef, reverbMergerRef,
      compRef, masterGainRef, meterSplitRef, lAnalyserRef, rAnalyserRef,
    ].forEach(r => safeDisconnect(r.current));
    Object.values(eqNodesRef.current).forEach(safeDisconnect);
    // A rebuild replaces the nodes the insert was spliced between, so the old
    // insert has to go with them or it keeps running detached.
    if (insertRef.current) { insertRef.current.dispose(); insertRef.current = null; }

    sourceRef.current = source;

    // ─── Balance (L/R Gain) ───
    const splitIn = ctx.createChannelSplitter(2);
    const lGain   = ctx.createGain();
    const rGain   = ctx.createGain();
    const merger  = ctx.createChannelMerger(2);
    source.connect(splitIn);
    splitIn.connect(lGain, 0);
    splitIn.connect(rGain, 1);
    lGain.connect(merger, 0, 0);
    rGain.connect(merger, 0, 1);

    // ─── Mid/Side Separation ───
    // Mid = (L+R)/2, Side = (L-R)/2  →  L' = mid + side*sideGain, R' = mid - side*sideGain
    // Implemented with splitter + 4 gain nodes and a merger.
    const msSplit  = ctx.createChannelSplitter(2);
    const midSumL  = ctx.createGain(); midSumL.gain.value = 0.5;
    const midSumR  = ctx.createGain(); midSumR.gain.value = 0.5;
    const sideSumL = ctx.createGain(); sideSumL.gain.value = 0.5;
    const sideSumR = ctx.createGain(); sideSumR.gain.value = -0.5;
    const midGain  = ctx.createGain(); midGain.gain.value = 1;
    const sideGain = ctx.createGain(); sideGain.gain.value = 1;
    const msMerge  = ctx.createChannelMerger(2);

    merger.connect(msSplit);
    msSplit.connect(midSumL, 0);
    msSplit.connect(midSumR, 1);
    msSplit.connect(sideSumL, 0);
    msSplit.connect(sideSumR, 1);
    midSumL.connect(midGain);
    midSumR.connect(midGain);
    sideSumL.connect(sideGain);
    sideSumR.connect(sideGain);
    // Recombine: L = mid + side, R = mid - side
    const sideInv = ctx.createGain(); sideInv.gain.value = -1;
    midGain.connect(msMerge, 0, 0);
    midGain.connect(msMerge, 0, 1);
    sideGain.connect(msMerge, 0, 0);
    sideGain.connect(sideInv);
    sideInv.connect(msMerge, 0, 1);

    // ─── 7-Zone Parametric EQ (shared config) ───
    let cursor = msMerge;
    eqNodesRef.current = {};
    PARAMETRIC_EQ_ZONES.forEach(b => {
      const f = ctx.createBiquadFilter();
      f.type = b.type;
      f.frequency.value = b.freq;
      f.Q.value = b.q;
      f.gain.value = 0;
      cursor.connect(f);
      cursor = f;
      eqNodesRef.current[b.key] = f;
    });

    // ─── Character chain ───
    // Saturator (Destroy)
    const saturator = ctx.createWaveShaper();
    saturator.curve = makeSaturationCurve(0);
    saturator.oversample = '4x';
    cursor.connect(saturator);
    cursor = saturator;

    // Sub low-shelf (Heaven Low)
    const subShelf = ctx.createBiquadFilter();
    subShelf.type = 'lowshelf';
    subShelf.frequency.value = 90;
    subShelf.gain.value = 0;
    cursor.connect(subShelf);
    cursor = subShelf;

    // Radio (telephone wet/dry): parallel path through HPF+LPF
    const radioDry    = ctx.createGain(); radioDry.gain.value = 1;
    const radioWet    = ctx.createGain(); radioWet.gain.value = 0;
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

    // Reverb (Space) — convolver wet/dry
    const reverbDry    = ctx.createGain(); reverbDry.gain.value = 1;
    const reverbWet    = ctx.createGain(); reverbWet.gain.value = 0;
    const reverbConv   = ctx.createConvolver();
    reverbConv.buffer  = makeImpulse(ctx, 2.2, 2.0);
    const reverbMerger = ctx.createGain();
    cursor.connect(reverbDry);
    cursor.connect(reverbConv);
    reverbConv.connect(reverbWet);
    reverbDry.connect(reverbMerger);
    reverbWet.connect(reverbMerger);
    cursor = reverbMerger;

    // Compressor (Master Punch)
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 12;
    comp.ratio.value = 2;
    comp.attack.value = 0.01;
    comp.release.value = 0.18;
    cursor.connect(comp);
    cursor = comp;

    // Master makeup gain (LUFS target)
    const master = ctx.createGain();
    master.gain.value = 1;
    cursor.connect(master);

    // Analysers (post-master, per channel)
    const meterSplit = ctx.createChannelSplitter(2);
    const lAna = ctx.createAnalyser(); lAna.fftSize = 1024; lAna.smoothingTimeConstant = 0.3;
    const rAna = ctx.createAnalyser(); rAna.fftSize = 1024; rAna.smoothingTimeConstant = 0.3;
    master.connect(meterSplit);
    meterSplit.connect(lAna, 0);
    meterSplit.connect(rAna, 1);
    master.connect(ctx.destination);

    // Store refs
    splitInRef.current     = splitIn;
    lGainRef.current       = lGain;
    rGainRef.current       = rGain;
    mergerRef.current      = merger;
    msSplitRef.current     = msSplit;
    midSumLRef.current     = midSumL;
    midSumRRef.current     = midSumR;
    sideSumLRef.current    = sideSumL;
    sideSumRRef.current    = sideSumR;
    midGainRef.current     = midGain;
    sideGainRef.current    = sideGain;
    msMergeRef.current     = msMerge;
    saturatorRef.current   = saturator;
    subShelfRef.current    = subShelf;
    radioDryRef.current    = radioDry;
    radioWetRef.current    = radioWet;
    radioHPFRef.current    = radioHPF;
    radioLPFRef.current    = radioLPF;
    radioMergerRef.current = radioMerger;
    reverbDryRef.current   = reverbDry;
    reverbWetRef.current   = reverbWet;
    reverbConvRef.current  = reverbConv;
    reverbMergerRef.current= reverbMerger;
    compRef.current        = comp;
    masterGainRef.current  = master;
    meterSplitRef.current  = meterSplit;
    lAnalyserRef.current   = lAna;
    rAnalyserRef.current   = rAna;
  }, []);

  // ─── Live setters (all use setTargetAtTime for smooth real-time changes) ───
  const t = () => ctxRef.current?.currentTime ?? 0;

  const setBalance = useCallback((balance /* -100..100 */) => {
    const lG = lGainRef.current, rG = rGainRef.current, ctx = ctxRef.current;
    if (!lG || !rG || !ctx) return;
    const b = balance / 100;
    const lPan = Math.cos((b + 1) * Math.PI / 4);
    const rPan = Math.sin((b + 1) * Math.PI / 4);
    const norm = 1 / Math.cos(Math.PI / 4);
    lG.gain.setTargetAtTime(lPan * norm, t(), 0.02);
    rG.gain.setTargetAtTime(rPan * norm, t(), 0.02);
  }, []);

  const setSeparation = useCallback((separation /* -100..100 */) => {
    const mid = midGainRef.current, side = sideGainRef.current;
    if (!mid || !side) return;
    // -100 → side=0 (mono), 0 → normal (mid=1, side=1), +100 → side=2 (wide)
    const s = separation / 100;
    const sideAmount = s < 0 ? 1 + s : 1 + s; // -1→0, 0→1, +1→2
    side.gain.setTargetAtTime(Math.max(0, sideAmount), t(), 0.03);
    mid.gain.setTargetAtTime(1, t(), 0.03);
  }, []);

  const setEQBand = useCallback((key, dB) => {
    const node = eqNodesRef.current[key];
    if (!node) return;
    node.gain.setTargetAtTime(dB, t(), 0.02);
  }, []);

  const setCharacter = useCallback((key, value /* 0..100 */) => {
    const v = Math.max(0, Math.min(100, value)) / 100;
    switch (key) {
      case 'destroy': {
        // Update waveshaper curve in steps (curves can't be automated; swap on threshold)
        if (saturatorRef.current) {
          saturatorRef.current.curve = makeSaturationCurve(v);
        }
        break;
      }
      case 'heaven_low': {
        // 0..12 dB low-shelf boost at 90 Hz
        if (subShelfRef.current) {
          subShelfRef.current.gain.setTargetAtTime(v * 12, t(), 0.02);
        }
        break;
      }
      case 'radio': {
        // Wet/dry between dry and telephone-band path
        if (radioDryRef.current && radioWetRef.current) {
          radioDryRef.current.gain.setTargetAtTime(1 - v * 0.85, t(), 0.02);
          radioWetRef.current.gain.setTargetAtTime(v, t(), 0.02);
        }
        break;
      }
      case 'space': {
        // Wet/dry reverb up to 40% wet
        if (reverbDryRef.current && reverbWetRef.current) {
          reverbDryRef.current.gain.setTargetAtTime(1 - v * 0.3, t(), 0.03);
          reverbWetRef.current.gain.setTargetAtTime(v * 0.4, t(), 0.03);
        }
        break;
      }
      case 'master_punch': {
        // Pull threshold from -10 down to -28, ratio 1.5 → 6, makeup gain 1 → 1.6
        if (compRef.current && masterGainRef.current) {
          compRef.current.threshold.setTargetAtTime(-10 - v * 18, t(), 0.05);
          compRef.current.ratio.setTargetAtTime(1.5 + v * 4.5, t(), 0.05);
          masterGainRef.current.gain.setTargetAtTime(1 + v * 0.6, t(), 0.05);
        }
        break;
      }
      default: break;
    }
  }, []);

  const setLufsTarget = useCallback((lufs /* -20..-6 */) => {
    // Map LUFS target to additional master gain: louder target → more gain.
    // -14 LUFS ≈ unity. -8 LUFS ≈ +6 dB. -20 LUFS ≈ -4 dB.
    if (!masterGainRef.current) return;
    const dB = (-14 - lufs) * -1; // -14→0, -8→+6, -20→-6
    const linear = Math.pow(10, dB / 20);
    masterGainRef.current.gain.setTargetAtTime(linear, t(), 0.08);
  }, []);

  /**
   * Splice a Foundry patch in as an insert between the compressor and the
   * master makeup gain — i.e. pre-limiter, post-character, which is where a
   * creator's own colour stage belongs. Pass null to remove it.
   *
   * Non-destructive by construction: this only re-routes the PREVIEW graph.
   * Nothing here writes to an asset; baking happens in the offline render.
   */
  const setInsert = useCallback(async (graph, bpm = 120) => {
    const comp = compRef.current;
    const master = masterGainRef.current;
    const ctx = ctxRef.current;
    if (!comp || !master || !ctx) return;

    // Detach whatever is currently between comp and master.
    safeDisconnect(comp);
    if (insertRef.current) {
      insertRef.current.dispose();
      insertRef.current = null;
    }

    if (!graph || !isInsertable(graph)) {
      comp.connect(master);
      return;
    }

    const insert = await buildFoundryInsert(ctx, graph, { bpm });
    comp.connect(insert.input);
    insert.output.connect(master);
    insertRef.current = insert;
  }, []);

  const getAnalysers = useCallback(() => ({
    left:  lAnalyserRef.current,
    right: rAnalyserRef.current,
  }), []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      [
        splitInRef, lGainRef, rGainRef, mergerRef,
        msSplitRef, midSumLRef, midSumRRef, sideSumLRef, sideSumRRef,
        midGainRef, sideGainRef, msMergeRef,
        saturatorRef, subShelfRef,
        radioWetRef, radioDryRef, radioHPFRef, radioLPFRef, radioMergerRef,
        reverbWetRef, reverbDryRef, reverbConvRef, reverbMergerRef,
        compRef, masterGainRef, meterSplitRef, lAnalyserRef, rAnalyserRef,
      ].forEach(r => safeDisconnect(r.current));
      Object.values(eqNodesRef.current).forEach(safeDisconnect);
    };
  }, []);

  // Stable identity: consumers put `chain` in effect dependency arrays, so a new
  // object on every render re-fires those effects and re-attaches the graph —
  // which loops until React tears the page down.
  return useMemo(() => ({
    attach,
    setBalance,
    setSeparation,
    setEQBand,
    setCharacter,
    setLufsTarget,
    setInsert,
    getAnalysers,
  }), [attach, setBalance, setSeparation, setEQBand, setCharacter, setLufsTarget, setInsert, getAnalysers]);
}