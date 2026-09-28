// ChordSeqAI (MIT, © 2023 Student Trainee Center — see NOTICES.md) next-chord
// suggestions, run entirely in the creator's browser via onnxruntime-web.
// Model + vocabulary are pinned to an exact upstream commit so a suggestion
// is reproducible and can't silently change under us.
import * as ort from 'onnxruntime-web';

const REPO = 'https://raw.githubusercontent.com/PetrIvan/chord-seq-ai-app/cae82407c7abdf1691ed7b4c13d59a87780762c6/';
export const GENRES = ['Rock', 'Folk', 'Pop', 'Soundtrack', 'R&B, Funk & Soul', 'Country', 'Jazz', 'Experimental', 'Religious Music', 'Reggae & Ska', 'Hip Hop', 'Electronic', 'Comedy', 'Metal', 'Blues', 'World Music', 'Disco', 'Classical', 'New Age', 'Darkwave'];
export const DECADES = [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];

// Only chord shapes our chord writer can voice are offered.
const SIMPLE = /^[A-G]#?(maj7|m7b5|m7|dim|aug|sus2|sus4|7|m)?$/;
const FLAT = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };
let vocabP, sessionP;

function loadVocab() {
  vocabP ||= fetch(`${REPO}src/data/token_to_chord.ts`).then((r) => r.text()).then((t) => {
    const map = JSON.parse(t.slice(t.indexOf('= {') + 2).trim().replace(/;\s*$/, '').replace(/,(\s*[\]}])/g, '$1'));
    const names = {}; const lookup = new Map();
    Object.entries(map).forEach(([k, list]) => {
      names[k] = list.find((n) => SIMPLE.test(n)) || null;
      list.forEach((n) => { if (!lookup.has(n)) lookup.set(n, Number(k)); });
    });
    return { names, lookup, count: Object.keys(map).length };
  }).catch((e) => { vocabP = null; throw e; });
  return vocabP;
}

function loadSession() {
  sessionP ||= (async () => {
    ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ort.env.versions.web}/dist/`;
    ort.env.wasm.numThreads = 1;
    return ort.InferenceSession.create(`${REPO}public/models/conditional_small.onnx`, { executionProviders: ['wasm'] });
  })().catch((e) => { sessionP = null; throw e; });
  return sessionP;
}

const normalize = (s) => {
  const m = s.trim().match(/^([A-G][#b]?)(.*)$/);
  return m ? (FLAT[m[1]] || m[1]) + (m[2] === 'min' ? 'm' : m[2]) : s;
};

/** Ranked next-chord suggestions for a progression, conditioned on genre + decade. */
export async function suggestNext(chords, { genre, decade }, limit = 8) {
  const [{ names, lookup, count }, session] = await Promise.all([loadVocab(), loadSession()]);
  const data = new BigInt64Array(256);
  data[0] = BigInt(count); // start token
  let n = 1; let last = -1;
  for (const c of chords) {
    const tok = lookup.get(normalize(c));
    if (tok === undefined || tok === last || n >= 255) continue;
    data[n++] = BigInt(tok); last = tok;
  }
  const style = new Float32Array(28);
  style[GENRES.indexOf(genre)] = 1;
  style[20 + DECADES.indexOf(decade)] = 1;
  const out = Object.values(await session.run({
    'input.1': new ort.Tensor('int64', data, [1, 256]),
    'onnx::Gemm_1': new ort.Tensor('float32', style, [1, 28]),
  }))[0];
  const V = out.dims[2];
  const row = out.data.slice((n - 1) * V, (n - 1) * V + count);
  const max = Math.max(...row);
  const exps = Array.from(row, (x, i) => (i === last ? 0 : Math.exp(x - max)));
  const sum = exps.reduce((a, b) => a + b, 0);
  const seen = new Set();
  return exps.map((e, i) => ({ chord: names[i], prob: e / sum }))
    .filter((s) => s.chord && !seen.has(s.chord) && seen.add(s.chord))
    .sort((a, b) => b.prob - a.prob).slice(0, limit);
}