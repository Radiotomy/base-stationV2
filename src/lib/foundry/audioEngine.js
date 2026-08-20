// BASE Foundry — modular Web Audio graph engine.
//
// ISOLATION: this file creates and owns its OWN AudioContext and touches nothing
// else in the platform. It never imports from the mastering chain, the BASE Mark
// path or any COS module, and nothing it does can write to an asset.
//
// Dropout discipline: parameter changes go through AudioParam ramps rather than
// teardown, and a topology change rebuilds into a NEW subgraph before the old one
// is released — so a rewire is a crossfade of graphs, not a gap in the audio.

import { NODE_DEFS } from './nodeTypes';

const DIVISIONS = { '4': 4, '2': 2, '1': 1, '1/2': 0.5, '1/4': 0.25, '1/8': 0.125, '1/16': 0.0625 };

function makeNoiseBuffer(ctx, color) {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      if (color === 'pink') {
        // Simple one-pole cascade — enough tilt to read as pink without a filter bank.
        b0 = 0.99765 * b0 + white * 0.099;
        b1 = 0.963 * b1 + white * 0.288;
        b2 = 0.57 * b2 + white * 1.022;
        d[i] = (b0 + b1 + b2 + white * 0.1848) * 0.25;
      } else {
        d[i] = white * 0.6;
      }
    }
  }
  return buf;
}

function makeImpulse(ctx, seconds, damping) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, damping);
    }
  }
  return buf;
}

function makeCurve(drive) {
  const n = 1024;
  const curve = new Float32Array(n);
  const k = drive;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

const RAMP = 0.02;
function ramp(param, value, ctx) {
  try {
    param.cancelScheduledValues(ctx.currentTime);
    param.setTargetAtTime(value, ctx.currentTime, RAMP);
  } catch {
    param.value = value;
  }
}

export default class FoundryEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.analyser = null;
    this.units = new Map();
    this.graph = { nodes: [], edges: [] };
    this.externalInput = null; // GainNode every 'input' node taps
    this.bpm = 120;
    this.running = false;
    this.bypassed = false;
    this.micStream = null;
    this.micSource = null;
    this._levelData = null;
  }

  async ensureContext() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this._levelData = new Float32Array(this.analyser.fftSize);
      this.externalInput = this.ctx.createGain();
      this.master.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }
    // An OfflineAudioContext also reports 'suspended', but resuming one STARTS
    // its render — so an adopted offline context must never be resumed here.
    const isOffline = typeof this.ctx.startRendering === 'function';
    if (!isOffline && this.ctx.state === 'suspended') await this.ctx.resume();
    return this.ctx;
  }

  /**
   * Adopt an EXISTING context and terminals so this graph can run as an insert
   * inside another chain (live mastering preview, or an offline render).
   *
   * The engine deliberately does NOT touch ctx.destination in this mode: an
   * insert that also talked to the speakers would double the signal and would
   * leak Foundry audio into a render it was not routed into.
   */
  async adopt(ctx, graph, { input, output, bpm = 120 }) {
    this.ctx = ctx;
    this.externalInput = input;
    this.master = output;
    this.bpm = bpm;
    await this.build(graph);
    return this;
  }

  /** Tear down the units but LEAVE the context alive (adopted-context path). */
  releaseUnits() {
    for (const unit of this.units.values()) { try { unit.dispose(); } catch {} }
    this.units.clear();
    this.running = false;
  }

  // ---- unit factory -------------------------------------------------------
  _createUnit(node) {
    const ctx = this.ctx;
    const p = node.params || {};
    switch (node.type) {
      case 'oscillator': {
        const osc = ctx.createOscillator();
        osc.type = p.wave || 'sawtooth';
        osc.frequency.value = p.frequency ?? 220;
        osc.detune.value = p.detune ?? 0;
        const g = ctx.createGain();
        g.gain.value = p.level ?? 0.5;
        osc.connect(g);
        osc.start();
        return {
          out: g,
          params: { frequency: osc.frequency, detune: osc.detune, level: g.gain },
          set: (k, v) => {
            if (k === 'wave') osc.type = v;
            else if (osc[k]) ramp(osc[k], v, ctx);
            else if (k === 'level') ramp(g.gain, v, ctx);
          },
          dispose: () => { try { osc.stop(); } catch {} osc.disconnect(); g.disconnect(); },
        };
      }
      case 'noise': {
        const src = ctx.createBufferSource();
        src.buffer = makeNoiseBuffer(ctx, p.color || 'white');
        src.loop = true;
        const g = ctx.createGain();
        g.gain.value = p.level ?? 0.3;
        src.connect(g);
        src.start();
        return {
          out: g,
          params: { level: g.gain },
          set: (k, v) => { if (k === 'level') ramp(g.gain, v, ctx); },
          rebuildOn: ['color'],
          dispose: () => { try { src.stop(); } catch {} src.disconnect(); g.disconnect(); },
        };
      }
      case 'sampler': {
        const g = ctx.createGain();
        g.gain.value = p.level ?? 0.8;
        let src = null;
        const load = async () => {
          if (!p.url) return;
          try {
            const res = await fetch(p.url);
            const buf = await ctx.decodeAudioData(await res.arrayBuffer());
            src = ctx.createBufferSource();
            src.buffer = buf;
            src.loop = p.loop !== false;
            src.playbackRate.value = p.rate ?? 1;
            src.connect(g);
            src.start();
          } catch { /* an unreachable sample must not take the graph down */ }
        };
        load();
        return {
          out: g,
          params: { level: g.gain },
          set: (k, v) => {
            if (k === 'level') ramp(g.gain, v, ctx);
            else if (k === 'rate' && src) ramp(src.playbackRate, v, ctx);
          },
          rebuildOn: ['url', 'loop'],
          dispose: () => { try { src?.stop(); } catch {} src?.disconnect(); g.disconnect(); },
        };
      }
      case 'filter': {
        const f = ctx.createBiquadFilter();
        f.type = p.mode || 'lowpass';
        f.frequency.value = p.cutoff ?? 1200;
        f.Q.value = p.resonance ?? 1.2;
        return {
          in: f,
          out: f,
          params: { cutoff: f.frequency, resonance: f.Q },
          set: (k, v) => {
            if (k === 'mode') f.type = v;
            else if (k === 'cutoff') ramp(f.frequency, v, ctx);
            else if (k === 'resonance') ramp(f.Q, v, ctx);
          },
          dispose: () => f.disconnect(),
        };
      }
      case 'delay': {
        const input = ctx.createGain();
        const dry = ctx.createGain();
        const wet = ctx.createGain();
        const merge = ctx.createGain();
        const splitL = ctx.createDelay(3);
        const splitR = ctx.createDelay(3);
        const fbL = ctx.createGain();
        const fbR = ctx.createGain();
        const panL = ctx.createStereoPanner();
        const panR = ctx.createStereoPanner();
        panL.pan.value = -0.7;
        panR.pan.value = 0.7;
        splitL.delayTime.value = p.time ?? 0.28;
        splitR.delayTime.value = (p.time ?? 0.28) + (p.spread ?? 0.03);
        fbL.gain.value = p.feedback ?? 0.35;
        fbR.gain.value = p.feedback ?? 0.35;
        const mix = p.mix ?? 0.3;
        dry.gain.value = 1 - mix;
        wet.gain.value = mix;
        input.connect(dry).connect(merge);
        input.connect(splitL);
        input.connect(splitR);
        // Cross-coupled feedback gives the stereo image movement a single
        // delay line cannot produce.
        splitL.connect(fbL).connect(splitR);
        splitR.connect(fbR).connect(splitL);
        splitL.connect(panL).connect(wet);
        splitR.connect(panR).connect(wet);
        wet.connect(merge);
        return {
          in: input,
          out: merge,
          params: { time: splitL.delayTime, feedback: fbL.gain, mix: wet.gain },
          set: (k, v) => {
            if (k === 'time') { ramp(splitL.delayTime, v, ctx); ramp(splitR.delayTime, v + (p.spread ?? 0.03), ctx); }
            else if (k === 'spread') ramp(splitR.delayTime, (p.time ?? 0.28) + v, ctx);
            else if (k === 'feedback') { ramp(fbL.gain, v, ctx); ramp(fbR.gain, v, ctx); }
            else if (k === 'mix') { ramp(wet.gain, v, ctx); ramp(dry.gain, 1 - v, ctx); }
          },
          dispose: () => [input, dry, wet, merge, splitL, splitR, fbL, fbR, panL, panR].forEach((n) => n.disconnect()),
        };
      }
      case 'reverb': {
        const input = ctx.createGain();
        const conv = ctx.createConvolver();
        conv.buffer = makeImpulse(ctx, p.size ?? 2.2, p.damping ?? 2.5);
        const dry = ctx.createGain();
        const wet = ctx.createGain();
        const merge = ctx.createGain();
        const mix = p.mix ?? 0.25;
        dry.gain.value = 1 - mix;
        wet.gain.value = mix;
        input.connect(dry).connect(merge);
        input.connect(conv).connect(wet).connect(merge);
        return {
          in: input,
          out: merge,
          params: { mix: wet.gain },
          set: (k, v) => {
            if (k === 'mix') { ramp(wet.gain, v, ctx); ramp(dry.gain, 1 - v, ctx); }
          },
          rebuildOn: ['size', 'damping'],
          dispose: () => [input, conv, dry, wet, merge].forEach((n) => n.disconnect()),
        };
      }
      case 'saturation': {
        const shaper = ctx.createWaveShaper();
        shaper.curve = makeCurve(p.drive ?? 6);
        shaper.oversample = '4x';
        const tone = ctx.createBiquadFilter();
        tone.type = 'lowpass';
        tone.frequency.value = p.tone ?? 9000;
        const outG = ctx.createGain();
        outG.gain.value = p.output ?? 0.8;
        shaper.connect(tone).connect(outG);
        return {
          in: shaper,
          out: outG,
          params: { tone: tone.frequency, output: outG.gain },
          set: (k, v) => {
            if (k === 'drive') shaper.curve = makeCurve(v);
            else if (k === 'tone') ramp(tone.frequency, v, ctx);
            else if (k === 'output') ramp(outG.gain, v, ctx);
          },
          dispose: () => [shaper, tone, outG].forEach((n) => n.disconnect()),
        };
      }
      case 'eq3': {
        const low = ctx.createBiquadFilter();
        low.type = 'lowshelf';
        low.frequency.value = 220;
        low.gain.value = p.low ?? 0;
        const mid = ctx.createBiquadFilter();
        mid.type = 'peaking';
        mid.frequency.value = p.mid_freq ?? 1000;
        mid.Q.value = 0.9;
        mid.gain.value = p.mid ?? 0;
        const high = ctx.createBiquadFilter();
        high.type = 'highshelf';
        high.frequency.value = 5000;
        high.gain.value = p.high ?? 0;
        low.connect(mid).connect(high);
        return {
          in: low,
          out: high,
          params: { low: low.gain, mid: mid.gain, mid_freq: mid.frequency, high: high.gain },
          set: (k, v) => {
            if (k === 'low') ramp(low.gain, v, ctx);
            else if (k === 'mid') ramp(mid.gain, v, ctx);
            else if (k === 'mid_freq') ramp(mid.frequency, v, ctx);
            else if (k === 'high') ramp(high.gain, v, ctx);
          },
          dispose: () => [low, mid, high].forEach((n) => n.disconnect()),
        };
      }
      case 'gain': {
        const g = ctx.createGain();
        g.gain.value = p.level ?? 1;
        return {
          in: g, out: g, params: { level: g.gain },
          set: (k, v) => { if (k === 'level') ramp(g.gain, v, ctx); },
          dispose: () => g.disconnect(),
        };
      }
      case 'lfo': {
        const osc = ctx.createOscillator();
        osc.type = p.wave || 'sine';
        const depth = ctx.createGain();
        depth.gain.value = p.depth ?? 400;
        const hz = p.sync !== false
          ? (this.bpm / 60) / (DIVISIONS[p.division] ?? 0.25)
          : (p.rate ?? 2);
        osc.frequency.value = hz;
        osc.connect(depth);
        osc.start();
        return {
          out: depth,
          isMod: true,
          params: { depth: depth.gain },
          set: (k, v) => {
            if (k === 'wave') osc.type = v;
            else if (k === 'depth') ramp(depth.gain, v, ctx);
            else if (k === 'rate' && p.sync === false) ramp(osc.frequency, v, ctx);
            else if (k === 'division' || k === 'sync') {
              const next = (k === 'sync' ? v : p.sync) !== false
                ? (this.bpm / 60) / (DIVISIONS[k === 'division' ? v : p.division] ?? 0.25)
                : (p.rate ?? 2);
              ramp(osc.frequency, next, ctx);
            }
          },
          syncBpm: (bpm) => {
            if (p.sync !== false) ramp(osc.frequency, (bpm / 60) / (DIVISIONS[p.division] ?? 0.25), ctx);
          },
          dispose: () => { try { osc.stop(); } catch {} osc.disconnect(); depth.disconnect(); },
        };
      }
      case 'adsr': {
        // A constant source scaled by an envelope gain — that is what lets an
        // ADSR modulate an AudioParam the same way an LFO does.
        const src = ctx.createConstantSource();
        src.offset.value = 1;
        const env = ctx.createGain();
        env.gain.value = 0;
        src.connect(env);
        src.start();
        const trigger = () => {
          const t = ctx.currentTime;
          const d = p.depth ?? 1000;
          env.gain.cancelScheduledValues(t);
          env.gain.setValueAtTime(env.gain.value, t);
          env.gain.linearRampToValueAtTime(d, t + (p.attack ?? 0.01));
          env.gain.linearRampToValueAtTime(d * (p.sustain ?? 0.6), t + (p.attack ?? 0.01) + (p.decay ?? 0.2));
        };
        const release = () => {
          const t = ctx.currentTime;
          env.gain.cancelScheduledValues(t);
          env.gain.setValueAtTime(env.gain.value, t);
          env.gain.linearRampToValueAtTime(0, t + (p.release ?? 0.4));
        };
        return {
          out: env, isMod: true, params: {}, trigger, release,
          set: () => {},
          dispose: () => { try { src.stop(); } catch {} src.disconnect(); env.disconnect(); },
        };
      }
      case 'input': {
        const g = ctx.createGain();
        this.externalInput.connect(g);
        return { out: g, params: {}, set: () => {}, dispose: () => g.disconnect() };
      }
      case 'output': {
        const g = ctx.createGain();
        g.gain.value = p.level ?? 0.9;
        g.connect(this.master);
        return {
          in: g, out: null, params: { level: g.gain },
          set: (k, v) => { if (k === 'level') ramp(g.gain, v, ctx); },
          dispose: () => g.disconnect(),
        };
      }
      default:
        return null;
    }
  }

  // ---- graph lifecycle ----------------------------------------------------
  async build(graph) {
    await this.ensureContext();
    const previous = this.units;
    this.units = new Map();
    this.graph = graph;

    for (const node of graph.nodes || []) {
      const unit = this._createUnit(node);
      if (unit) this.units.set(node.id, unit);
    }

    for (const edge of graph.edges || []) {
      const src = this.units.get(edge.from);
      const dst = this.units.get(edge.to);
      if (!src?.out || !dst) continue;
      try {
        if (edge.toParam) {
          const target = dst.params?.[edge.toParam];
          if (target) src.out.connect(target);
        } else if (dst.in) {
          src.out.connect(dst.in);
        }
      } catch { /* an invalid wire is ignored, never fatal */ }
    }

    // Release the previous graph only once the new one is live, so the swap is
    // inaudible rather than a gap.
    for (const unit of previous.values()) {
      try { unit.dispose(); } catch {}
    }
    this.running = true;
  }

  /**
   * Live parameter update. Returns true when handled in place; false means the
   * parameter changes topology (a buffer, a URL) and the caller must rebuild.
   */
  setParam(nodeId, key, value) {
    const node = (this.graph.nodes || []).find((n) => n.id === nodeId);
    if (node) node.params = { ...node.params, [key]: value };
    const unit = this.units.get(nodeId);
    if (!unit) return false;
    if (unit.rebuildOn?.includes(key)) return false;
    unit.set?.(key, value);
    return true;
  }

  setBpm(bpm) {
    this.bpm = bpm;
    for (const unit of this.units.values()) unit.syncBpm?.(bpm);
  }

  triggerEnvelopes() {
    for (const unit of this.units.values()) unit.trigger?.();
  }

  releaseEnvelopes() {
    for (const unit of this.units.values()) unit.release?.();
  }

  setBypass(on) {
    this.bypassed = on;
    if (this.master) ramp(this.master.gain, on ? 0 : 0.9, this.ctx);
  }

  /** Route an <audio> element through the graph's Insert Input nodes. */
  connectElement(el) {
    if (!this.ctx || !el) return;
    if (!el._foundrySource) el._foundrySource = this.ctx.createMediaElementSource(el);
    try { el._foundrySource.connect(this.externalInput); } catch {}
  }

  /**
   * Internal audition loop. An EFFECT graph starts from an Insert Input node, so
   * with no track loaded and no mic it would be silent — and silence reads as a
   * broken plugin. This feeds a rhythmic test signal so the chain is audible.
   */
  startTestLoop() {
    if (!this.ctx || this._test) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer(ctx, 'pink');
    src.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 900;
    band.Q.value = 0.7;
    const pulse = ctx.createGain();
    pulse.gain.value = 0;
    src.connect(band).connect(pulse).connect(this.externalInput);
    src.start();

    // A repeating 8th-note pulse at the current tempo — transients are what make
    // delays, envelopes and saturation legible.
    const step = 30 / this.bpm;
    let t = ctx.currentTime + 0.05;
    const schedule = () => {
      const horizon = ctx.currentTime + 1;
      while (t < horizon) {
        pulse.gain.setValueAtTime(0.0001, t);
        pulse.gain.exponentialRampToValueAtTime(0.6, t + 0.005);
        pulse.gain.exponentialRampToValueAtTime(0.0001, t + step * 0.6);
        t += step;
      }
    };
    schedule();
    this._test = { src, pulse, timer: setInterval(schedule, 400) };
  }

  stopTestLoop() {
    if (!this._test) return;
    clearInterval(this._test.timer);
    try { this._test.src.stop(); } catch {}
    this._test.src.disconnect();
    this._test.pulse.disconnect();
    this._test = null;
  }

  async startMic() {
    await this.ensureContext();
    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.micSource = this.ctx.createMediaStreamSource(this.micStream);
    this.micSource.connect(this.externalInput);
  }

  stopMic() {
    try { this.micSource?.disconnect(); } catch {}
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.micSource = null;
    this.micStream = null;
  }

  /** Peak level 0..1 for the meters. */
  getLevel() {
    if (!this.analyser || !this._levelData) return 0;
    this.analyser.getFloatTimeDomainData(this._levelData);
    let peak = 0;
    for (let i = 0; i < this._levelData.length; i++) {
      const v = Math.abs(this._levelData[i]);
      if (v > peak) peak = v;
    }
    return Math.min(1, peak);
  }

  async destroy() {
    for (const unit of this.units.values()) { try { unit.dispose(); } catch {} }
    this.units.clear();
    this.stopTestLoop();
    this.stopMic();
    this.running = false;
    try { await this.ctx?.close(); } catch {}
    this.ctx = null;
  }
}

/** Compile a canvas graph into the stored, engine-facing dsp_definition. */
export function compileGraph(graph) {
  const byId = new Map((graph.nodes || []).map((n) => [n.id, n]));
  return {
    version: 1,
    units: (graph.nodes || []).map((n) => ({
      id: n.id,
      type: n.type,
      label: NODE_DEFS[n.type]?.label || n.type,
      params: n.params || {},
    })),
    routing: (graph.edges || []).map((e) => ({
      from: e.from,
      to: e.to,
      target: e.toParam || 'audio',
      from_type: byId.get(e.from)?.type,
      to_type: byId.get(e.to)?.type,
    })),
  };
}