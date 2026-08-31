/**
 * htdemucs_6s running in the browser tab via onnxruntime-web.
 *
 * The audio never leaves the device — this is the privacy/zero-cost path that
 * complements the Sever engine, not a faster one. Honest numbers on the two
 * constraints that shape everything below:
 *
 *  - The exported graph is FIXED at exactly 7.8 s of stereo 44.1 kHz
 *    (mix shape [1, 2, 343980]), so any real track must be chunked with
 *    overlap-add. That is not an optimization, it is the only way to run it.
 *  - Multi-threaded WASM needs COOP/COEP response headers, which we cannot set
 *    on this host. So we pin numThreads to 1 rather than letting ORT probe for
 *    SharedArrayBuffer and throw. Expect roughly real-time (~6 s per 7.8 s
 *    chunk on a fast laptop, slower on phones).
 */

import * as ort from 'onnxruntime-web';

// fp16-stored weights: 136 MB instead of 258 MB, identical runtime cost and
// accuracy (the graph still computes in fp32). Browser cache keeps it after
// the first load, so the big download is a one-time cost per device.
const MODEL_URL =
  'https://huggingface.co/StemSplitio/htdemucs-6s-onnx/resolve/main/htdemucs_6s_fp16weights.onnx';

// Exact output row order of the 6-stem graph. Wrong order = silently swapped
// stems, which is why this is a single source of truth rather than inlined.
export const SOURCES = ['drums', 'bass', 'other', 'vocals', 'guitar', 'piano'];

export const MODEL_SAMPLE_RATE = 44100;
export const MODEL_MB = 136;

const N_SAMPLES = Math.round(7.8 * MODEL_SAMPLE_RATE); // 343,980 — baked into the graph
const OVERLAP = Math.floor(N_SAMPLES / 4);
const STRIDE = N_SAMPLES - OVERLAP;

let sessionPromise = null;

/** Triangular fade in/out so overlapping chunks sum without seams. */
function makeTransitionWindow() {
  const w = new Float32Array(N_SAMPLES).fill(1);
  for (let i = 0; i < OVERLAP; i++) {
    w[i] = i / OVERLAP;
    w[N_SAMPLES - 1 - i] = i / OVERLAP;
  }
  return w;
}

/**
 * Fetch the model with byte progress, then build one inference session.
 * Cached in a module-level promise: the weights are 136 MB, so a second
 * concurrent caller must join the first download rather than start another.
 */
export function loadSession(onProgress) {
  if (sessionPromise) return sessionPromise;

  sessionPromise = (async () => {
    // ORT resolves its .wasm binaries relative to the bundle by default, which
    // Vite does not emit — point it at the matching CDN build instead.
    ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ort.env.versions.web}/dist/`;
    ort.env.wasm.numThreads = 1; // no COOP/COEP on this host — see file header

    const res = await fetch(MODEL_URL);
    if (!res.ok) throw new Error(`Model download failed (${res.status})`);

    const total = Number(res.headers.get('content-length')) || MODEL_MB * 1024 * 1024;
    const reader = res.body.getReader();
    const parts = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
      received += value.length;
      onProgress?.(Math.min(0.99, received / total));
    }
    onProgress?.(1);

    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.length; }

    return ort.InferenceSession.create(bytes.buffer, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
  })().catch((e) => {
    sessionPromise = null; // a failed load must not poison later attempts
    throw e;
  });

  return sessionPromise;
}

/**
 * Separate a full-length mix into the requested stems.
 *
 * `rows` selects which sources to keep. Every row costs another full-length
 * stereo buffer (~32 MB per stem per 3 minutes), so asking for all six on a
 * phone is how this runs out of memory — the caller decides, deliberately.
 */
export async function separate(session, mix, rows, onProgress) {
  const total = mix[0].length;
  const nChunks = Math.max(1, Math.ceil(total / STRIDE));
  const window = makeTransitionWindow();
  const chunkBuf = new Float32Array(2 * N_SAMPLES);

  const out = {};
  for (const row of rows) out[row] = [new Float32Array(total), new Float32Array(total)];
  const weight = new Float32Array(total);

  for (let i = 0; i < nChunks; i++) {
    const start = i * STRIDE;
    const end = Math.min(start + N_SAMPLES, total);
    const clen = end - start;

    chunkBuf.fill(0); // last chunk is short — zero-pad rather than reuse stale audio
    for (let c = 0; c < 2; c++) {
      chunkBuf
        .subarray(c * N_SAMPLES, c * N_SAMPLES + clen)
        .set(mix[c].subarray(start, end));
    }

    const result = await session.run({
      mix: new ort.Tensor('float32', chunkBuf, [1, 2, N_SAMPLES]),
    });
    const stems = result.stems.data;

    for (const row of rows) {
      const rowOffset = row * 2 * N_SAMPLES;
      const dst = out[row];
      for (let c = 0; c < 2; c++) {
        const chOffset = rowOffset + c * N_SAMPLES;
        for (let s = 0; s < clen; s++) {
          dst[c][start + s] += stems[chOffset + s] * window[s];
        }
      }
    }
    for (let s = 0; s < clen; s++) weight[start + s] += window[s];

    onProgress?.((i + 1) / nChunks);
    // Yield to the event loop so the tab stays responsive between chunks.
    await new Promise((r) => setTimeout(r, 0));
  }

  // Undo the window weighting so overlapped regions keep unity gain.
  for (const row of rows) {
    for (let c = 0; c < 2; c++) {
      const ch = out[row][c];
      for (let s = 0; s < total; s++) ch[s] /= Math.max(weight[s], 1e-8);
    }
  }

  return out;
}

/** Chunk count for a given length — lets the UI show a real time estimate. */
export function estimateChunks(samples) {
  return Math.max(1, Math.ceil(samples / STRIDE));
}