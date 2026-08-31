// Clap — LAION CLAP embedding service on our own Hugging Face Space.
// Text and audio embed into the SAME 512-d space, which is what lets a typed
// query be scored against stored audio embeddings by plain cosine similarity.
//
// Vectors arrive L2-NORMALIZED from the Space, so similarity here is a dot
// product. Never mix in a vector from anywhere else: two embeddings are only
// comparable when they came from the same checkpoint, which is why CLAP_MODEL
// is stamped onto every stored embedding rather than assumed.

export const CLAP_BASE_URL = 'https://radiotomy-clap.hf.space';
export const CLAP_MODEL = 'laion/larger_clap_music_and_speech';
export const CLAP_DIM = 512;

// The first call after the Space idles pays for lazy model loading — give the
// cold start real room rather than reporting the engine as down.
const TEXT_TIMEOUT_MS = 120000;
const AUDIO_TIMEOUT_MS = 180000;

async function callClap(path, body, timeoutMs) {
  let res;
  try {
    res = await fetch(`${CLAP_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    throw new Error(`Search engine unreachable (it may be warming up — try again in a minute): ${e.message}`);
  }
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Search engine HTTP ${res.status}${t ? `: ${t.slice(0, 200)}` : ''}`);
  }
  const data = await res.json().catch(() => null);
  const embedding = data?.embedding;
  if (!Array.isArray(embedding) || embedding.length !== CLAP_DIM) {
    throw new Error('Search engine returned a malformed embedding');
  }
  return { embedding, seconds: data.seconds || 0 };
}

export async function embedText(text) {
  const { embedding } = await callClap('/embed/text', { text }, TEXT_TIMEOUT_MS);
  return embedding;
}

export async function embedAudio(audioUrl) {
  return await callClap('/embed/audio', { audio_url: audioUrl }, AUDIO_TIMEOUT_MS);
}

// Dot product — valid ONLY because both sides are normalized at the source.
export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return -1;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}