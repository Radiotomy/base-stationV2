/**
 * Phase 6 — AudioWorklet processor: captures the performer's mic as raw
 * Float32 PCM mono blocks (~50ms) and posts each to the main thread, where
 * useStreamrAudio publishes it onto the Streamr network.
 *
 * Runs in the AudioWorkletGlobalScope: `sampleRate` and `registerProcessor`
 * are globals provided by the host.
 */
/* global AudioWorkletProcessor, sampleRate, registerProcessor */
class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const targetMs = options?.processorOptions?.targetMs || 50;
    this._target = Math.max(128, Math.round((targetMs / 1000) * sampleRate));
    this._blocks = [];
    this._acc = 0;
  }

  process(inputs) {
    const input = inputs[0];
    const ch0 = input && input[0];
    if (!ch0 || ch0.length === 0) return true;

    // Downmix to mono.
    let mono;
    if (input.length > 1) {
      mono = new Float32Array(ch0.length);
      for (let i = 0; i < ch0.length; i++) {
        let s = 0;
        for (let c = 0; c < input.length; c++) s += input[c][i] || 0;
        mono[i] = s / input.length;
      }
    } else {
      mono = new Float32Array(ch0);
    }

    this._blocks.push(mono);
    this._acc += mono.length;

    if (this._acc >= this._target) {
      const merged = new Float32Array(this._acc);
      let off = 0;
      for (const b of this._blocks) { merged.set(b, off); off += b.length; }
      this._blocks = [];
      this._acc = 0;
      // Transfer the underlying buffer to the main thread (zero-copy).
      this.port.postMessage({ samples: merged, sr: sampleRate }, [merged.buffer]);
    }
    return true;
  }
}

registerProcessor('pcm-capture', PcmCaptureProcessor);