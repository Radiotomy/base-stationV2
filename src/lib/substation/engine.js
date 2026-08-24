// SUB-Station Web Audio engine.
// One master chain (EQ → compressor → limiter → analyser), one gain+panner per
// track, plus sends for delay and reverb. Transport position is DERIVED from
// ctx.currentTime rather than stored, so a dropped frame can never desync it.
import { audioBufferToWav } from './wav';

export const beatsToSec = (beats, bpm) => (beats * 60) / bpm;
export const secToBeats = (sec, bpm) => (sec * bpm) / 60;
export const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

function buildImpulse(ctx, seconds, decay) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = buf.getChannelData(c);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

export default class SubEngine {
  constructor() {
    this.ctx = null;
    this.tracks = new Map();
    this.buffers = new Map();
    this.voices = new Map();
    this.sources = [];
    this.startTime = 0;
    this.startBeat = 0;
    this.playing = false;
    this.bpm = 96;
    this.metroTimer = null;
  }

  ensure() {
    if (this.ctx) return this.ctx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    this.ctx = ctx;

    this.input = ctx.createGain();
    this.eqLow = ctx.createBiquadFilter(); this.eqLow.type = 'lowshelf'; this.eqLow.frequency.value = 180;
    this.eqMid = ctx.createBiquadFilter(); this.eqMid.type = 'peaking'; this.eqMid.Q.value = 0.9;
    this.eqHigh = ctx.createBiquadFilter(); this.eqHigh.type = 'highshelf'; this.eqHigh.frequency.value = 5200;
    this.comp = ctx.createDynamicsCompressor();
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.ratio.value = 20; this.limiter.attack.value = 0.002; this.limiter.release.value = 0.08;
    this.master = ctx.createGain();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;

    // Sends
    this.delay = ctx.createDelay(2);
    this.delayFb = ctx.createGain();
    this.delayMix = ctx.createGain();
    this.delay.connect(this.delayFb); this.delayFb.connect(this.delay);
    this.delay.connect(this.delayMix);
    this.reverb = ctx.createConvolver();
    this.reverbMix = ctx.createGain();
    this.reverb.connect(this.reverbMix);

    this.input.connect(this.eqLow); this.eqLow.connect(this.eqMid); this.eqMid.connect(this.eqHigh);
    this.eqHigh.connect(this.comp); this.comp.connect(this.limiter);
    this.limiter.connect(this.master);
    this.input.connect(this.delay); this.input.connect(this.reverb);
    this.delayMix.connect(this.master); this.reverbMix.connect(this.master);
    this.master.connect(this.analyser);
    this.analyser.connect(ctx.destination);
    return ctx;
  }

  async resume() { this.ensure(); if (this.ctx.state === 'suspended') await this.ctx.resume(); }

  applyFx(fx) {
    if (!this.ctx) return;
    this.eqLow.gain.value = fx.eq.low;
    this.eqMid.gain.value = fx.eq.mid;
    this.eqMid.frequency.value = fx.eq.midFreq;
    this.eqHigh.gain.value = fx.eq.high;
    this.comp.threshold.value = fx.comp.threshold;
    this.comp.ratio.value = fx.comp.ratio;
    this.comp.attack.value = fx.comp.attack;
    this.comp.release.value = fx.comp.release;
    this.limiter.threshold.value = fx.limiter.ceiling;
    this.delay.delayTime.value = fx.delay.time;
    this.delayFb.gain.value = Math.min(0.85, fx.delay.feedback);
    this.delayMix.gain.value = fx.delay.mix;
    this.reverbMix.gain.value = fx.reverb.mix;
    if (this._revSize !== fx.reverb.size) {
      this._revSize = fx.reverb.size;
      this.reverb.buffer = buildImpulse(this.ctx, fx.reverb.size, 2.6);
    }
  }

  syncTracks(tracks) {
    this.ensure();
    const anySolo = tracks.some(t => t.solo);
    tracks.forEach((t) => {
      let node = this.tracks.get(t.id);
      if (!node) {
        const gain = this.ctx.createGain();
        const pan = this.ctx.createStereoPanner();
        gain.connect(pan); pan.connect(this.input);
        node = { gain, pan };
        this.tracks.set(t.id, node);
      }
      const audible = !t.mute && (!anySolo || t.solo);
      node.gain.gain.value = audible ? t.volume : 0;
      node.pan.pan.value = t.pan;
    });
    // Drop nodes for deleted tracks
    [...this.tracks.keys()].forEach((id) => {
      if (!tracks.some(t => t.id === id)) {
        try { this.tracks.get(id).gain.disconnect(); } catch { /* ignore */ }
        this.tracks.delete(id);
      }
    });
  }

  trackNode(id) { return this.tracks.get(id) || null; }

  async loadBuffer(url) {
    if (!url) return null;
    if (this.buffers.has(url)) return this.buffers.get(url);
    this.ensure();
    try {
      const res = await fetch(url);
      const arr = await res.arrayBuffer();
      const buf = await this.ctx.decodeAudioData(arr);
      this.buffers.set(url, buf);
      return buf;
    } catch {
      this.buffers.set(url, null);
      return null;
    }
  }

  async preload(session) {
    const urls = session.tracks.flatMap(t => t.clips.map(c => c.url).filter(Boolean));
    await Promise.all([...new Set(urls)].map(u => this.loadBuffer(u)));
  }

  scheduleSynthNote(dest, freq, when, duration, gainVal = 0.6) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth'; sub.type = 'sine';
    osc.frequency.value = freq; sub.frequency.value = freq / 2;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = Math.min(8000, freq * 8);
    osc.connect(filt); sub.connect(filt); filt.connect(g); g.connect(dest);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gainVal, when + 0.02);
    g.gain.setTargetAtTime(0.0001, when + Math.max(0.05, duration - 0.08), 0.05);
    osc.start(when); sub.start(when);
    osc.stop(when + duration + 0.2); sub.stop(when + duration + 0.2);
    this.sources.push(osc, sub);
  }

  async play(session, fromBeat = 0) {
    await this.resume();
    this.stopSources();
    this.bpm = session.bpm;
    this.applyFx(session.fx);
    this.syncTracks(session.tracks);
    await this.preload(session);

    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.06;
    this.startTime = t0;
    this.startBeat = fromBeat;
    this.playing = true;

    session.tracks.forEach((t) => {
      const node = this.tracks.get(t.id);
      if (!node) return;
      t.clips.forEach((clip) => {
        const relStart = beatsToSec(clip.start - fromBeat, session.bpm);
        const dur = beatsToSec(clip.length, session.bpm);
        if (relStart + dur <= 0) return;
        const when = t0 + Math.max(0, relStart);
        const skip = Math.max(0, -relStart);
        if (clip.url) {
          const buf = this.buffers.get(clip.url);
          if (!buf) return;
          const src = ctx.createBufferSource();
          src.buffer = buf;
          const g = ctx.createGain();
          g.gain.value = clip.gain ?? 1;
          src.connect(g); g.connect(node.gain);
          const offset = (clip.offset || 0) + skip;
          if (offset >= buf.duration) return;
          src.start(when, offset, Math.min(dur - skip, buf.duration - offset));
          this.sources.push(src);
        } else {
          this.scheduleSynthNote(node.gain, clip.pitch || 220, when, dur - skip, (clip.gain ?? 1) * 0.5);
        }
      });
    });

    if (session.metronome) this.startMetronome(session.bpm);
  }

  startMetronome(bpm) {
    this.stopMetronome();
    const period = 60 / bpm;
    let next = this.ctx.currentTime + 0.05;
    this.metroTimer = setInterval(() => {
      while (next < this.ctx.currentTime + 0.3) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.frequency.value = 1600;
        g.gain.setValueAtTime(0.18, next);
        g.gain.exponentialRampToValueAtTime(0.0005, next + 0.05);
        osc.connect(g); g.connect(this.master);
        osc.start(next); osc.stop(next + 0.06);
        next += period;
      }
    }, 120);
  }

  stopMetronome() { if (this.metroTimer) { clearInterval(this.metroTimer); this.metroTimer = null; } }

  stopSources() {
    this.sources.forEach((s) => { try { s.stop(); } catch { /* already stopped */ } });
    this.sources = [];
  }

  pause() {
    this.playing = false;
    this.startBeat = this.position();
    this.stopSources();
    this.stopMetronome();
  }

  stop() {
    this.playing = false;
    this.startBeat = 0;
    this.stopSources();
    this.stopMetronome();
  }

  position() {
    if (!this.ctx || !this.playing) return this.startBeat;
    return Math.max(0, this.startBeat + secToBeats(this.ctx.currentTime - this.startTime, this.bpm));
  }

  // Live playable keypad — polyphonic, routed through the armed track's strip.
  noteOn(midi, trackId) {
    this.ensure();
    this.resume();
    const dest = this.tracks.get(trackId)?.gain || this.input;
    const ctx = this.ctx;
    const freq = midiToFreq(midi);
    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const filt = ctx.createBiquadFilter();
    const g = ctx.createGain();
    osc.type = 'sawtooth'; sub.type = 'sine';
    osc.frequency.value = freq; sub.frequency.value = freq / 2;
    filt.type = 'lowpass'; filt.frequency.value = Math.min(9000, freq * 9);
    osc.connect(filt); sub.connect(filt); filt.connect(g); g.connect(dest);
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.015);
    osc.start(); sub.start();
    this.voices.set(midi, { osc, sub, g });
  }

  noteOff(midi) {
    const v = this.voices.get(midi);
    if (!v) return;
    const now = this.ctx.currentTime;
    v.g.gain.cancelScheduledValues(now);
    v.g.gain.setTargetAtTime(0.0001, now, 0.06);
    try { v.osc.stop(now + 0.5); v.sub.stop(now + 0.5); } catch { /* ignore */ }
    this.voices.delete(midi);
  }

  levels() {
    if (!this.analyser) return { peak: 0, spectrum: null };
    const arr = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(arr);
    let peak = 0;
    for (let i = 0; i < arr.length; i++) peak = Math.max(peak, arr[i]);
    return { peak: peak / 255, spectrum: arr };
  }

  // ── Offline bounce ────────────────────────────────────────────────
  async renderTracks(session, tracks) {
    const lengthBeats = Math.max(
      4,
      ...session.tracks.flatMap(t => t.clips.map(c => c.start + c.length)),
      session.loop.enabled ? session.loop.end : 0
    );
    const seconds = beatsToSec(lengthBeats, session.bpm) + 1.5;
    const rate = 44100;
    const off = new OfflineAudioContext(2, Math.ceil(seconds * rate), rate);

    const master = off.createGain();
    const limiter = off.createDynamicsCompressor();
    limiter.threshold.value = session.fx.limiter.ceiling;
    limiter.ratio.value = 20;
    limiter.connect(master);
    master.connect(off.destination);

    for (const t of tracks) {
      const g = off.createGain();
      const p = off.createStereoPanner();
      g.gain.value = t.mute ? 0 : t.volume;
      p.pan.value = t.pan;
      g.connect(p); p.connect(limiter);

      for (const clip of t.clips) {
        const when = beatsToSec(clip.start, session.bpm);
        const dur = beatsToSec(clip.length, session.bpm);
        if (clip.url) {
          const buf = this.buffers.get(clip.url) || await this.loadBuffer(clip.url);
          if (!buf) continue;
          // Re-decode into the offline rate context via a buffer copy
          const src = off.createBufferSource();
          const copy = off.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
          for (let c = 0; c < buf.numberOfChannels; c++) copy.copyToChannel(buf.getChannelData(c), c);
          src.buffer = copy;
          const cg = off.createGain();
          cg.gain.value = clip.gain ?? 1;
          src.connect(cg); cg.connect(g);
          src.start(when, clip.offset || 0, Math.min(dur, copy.duration));
        } else {
          const freq = clip.pitch || 220;
          const osc = off.createOscillator();
          const sub = off.createOscillator();
          const filt = off.createBiquadFilter();
          const ng = off.createGain();
          osc.type = 'sawtooth'; sub.type = 'sine';
          osc.frequency.value = freq; sub.frequency.value = freq / 2;
          filt.type = 'lowpass'; filt.frequency.value = Math.min(8000, freq * 8);
          osc.connect(filt); sub.connect(filt); filt.connect(ng); ng.connect(g);
          ng.gain.setValueAtTime(0, when);
          ng.gain.linearRampToValueAtTime((clip.gain ?? 1) * 0.5, when + 0.02);
          ng.gain.setTargetAtTime(0.0001, when + Math.max(0.06, dur - 0.08), 0.05);
          osc.start(when); sub.start(when);
          osc.stop(when + dur + 0.2); sub.stop(when + dur + 0.2);
        }
      }
    }

    const rendered = await off.startRendering();
    return audioBufferToWav(rendered);
  }

  async bounce(session, { stems = true } = {}) {
    this.ensure();
    await this.preload(session);
    const master = await this.renderTracks(session, session.tracks);
    const out = { master, stems: [] };
    if (stems) {
      for (const t of session.tracks) {
        if (!t.clips.length) continue;
        const blob = await this.renderTracks(session, [{ ...t, mute: false }]);
        out.stems.push({ name: t.name, blob });
      }
    }
    return out;
  }

  dispose() {
    this.stop();
    try { this.ctx?.close(); } catch { /* ignore */ }
    this.ctx = null;
    this.tracks.clear();
  }
}