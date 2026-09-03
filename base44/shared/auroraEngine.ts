// Aurora — BASE Station's long-form song engine, powered by MiniMax-Music3
// (huggingface.co/MiniMaxAI/MiniMax-Music3), self-hosted on our own Hugging Face
// Space (huggingface.co/spaces/Radiotomy/Aurora).
//
// LICENCE — load-bearing, do not "clean up":
//   MiniMax-Music3 is under the MiniMax-Music3 COMMUNITY LICENSE. Commercial use
//   is free below USD 20M aggregate yearly revenue, but clause 3.1 REQUIRES the
//   string "MiniMax-Music3" to be prominently displayed on the UI of any
//   commercial product using it. That is why Aurora — unlike CODA, Siren Song and
//   Skye — is never presented as a pure in-house fork: the attribution is a
//   licence condition, not branding taste. Clause 4 additionally requires
//   maintained safeguards against infringing/AUP-violating outputs, which is what
//   the prompt guard below and the COS + BASE Mark cascade satisfy.
//
// Engine contract (mirrors Coda / Siren Song / Skye so the persistence and
// restart-handling work is shared rather than reinvented):
//   POST /generate  { prompt, lyrics, duration, seed }
//        → { task_id, status }
//   GET  /status/{task_id}
//        → { status: queued|processing|completed|failed, progress, result_url? }
//   GET  /engine/health → persistence report
//
// Conditioning notes that drive the UI:
//   prompt   — the music description. MiniMax was trained on a three-block
//              STRUCTURED CAPTION (Global Metadata / Vocal Details /
//              Arrangement); the studio compiles that client-side and sends it
//              here as one string, because the model takes a single text field.
//   lyrics   — section tags on their own lines: [Intro] [Verse] [Pre-Chorus]
//              [Chorus] [Post-Chorus] [Bridge] [Instrumental] [Solo] [Outro].
//              Unlike Skye's DiffRhythm parser these are read as WRITTEN, so no
//              token rewriting happens here.
//   duration — native full-song window up to 300s. max_new_tokens is derived on
//              the Space at 25 frames per second, which is the model's frame rate.

const ENGINE_BASE = 'https://radiotomy-aurora.hf.space';

const SUBMIT_TIMEOUT_MS = 90000;
const STATUS_TIMEOUT_MS = 15000;
// A five-minute 32kHz stereo render is ~57MB, and the Space may be on a cold
// disk read — a tight download timeout would abandon a finished song.
const DOWNLOAD_TIMEOUT_MS = 240000;

// The model card's native window: complete songs up to five minutes. The floor is
// ours, not the model's — below ~30s MiniMax has no room to build the intro/verse
// structure it is designed around, so a shorter ask produces a truncated section
// rather than a short song.
export const AURORA_MIN_DURATION = 30;
export const AURORA_MAX_DURATION = 300;
export const AURORA_DEFAULT_DURATION = 120;

// MiniMax generates audio frames at 25 fps; max_new_tokens is a frame budget.
export const AURORA_FRAMES_PER_SECOND = 25;

// Credits per render. Above Skye (14) because Aurora runs an 8B LLM plus a 2.4B
// flow-matching stack on a larger GPU tier, and its window is 300s vs 210s.
export const AURORA_COST = 18;

// Model identity recorded on every job and asset. Kept as the upstream repo id so
// a provenance record names the exact weights, which is what the licence's
// attribution and safeguard clauses are about.
export const AURORA_MODEL_ID = 'MiniMaxAI/MiniMax-Music3';
export const AURORA_MODEL_LABEL = 'Aurora (MiniMax-Music3)';

// Native output format, per the model card: 32 kHz, 16-bit stereo WAV. Real PCM,
// so an Aurora master goes into the BASE Mark V1 spectral layer directly — no
// transcode step that would destroy the mark.
export const AURORA_SAMPLE_RATE = 32000;

// Acceptable Use Policy guard (licence clause 4). Deliberately narrow: it blocks
// the categories the AUP names explicitly and nothing else, because a broad
// keyword filter that refuses ordinary songwriting would push creators to work
// around the safeguard rather than within it.
const AUP_PATTERNS: [RegExp, string][] = [
  [/\b(sound|voice|vocals?|style)\s+(exactly\s+)?(like|of)\s+(taylor swift|drake|beyonc|kanye|ariana|billie eilish|the beatles|michael jackson|rihanna|adele|ed sheeran|bad bunny)/i,
    'Impersonating a named recording artist\'s voice or identity'],
  [/\b(clone|impersonate|deepfake|mimic)\b.{0,30}\b(voice|singer|artist)\b/i,
    'Voice cloning or impersonation of a real person'],
  [/\b(child|minor|underage)\b.{0,40}\b(sexual|explicit|nude)/i, 'Content sexualising minors'],
  [/\b(terrorism|terrorist recruitment|violent extremis)/i, 'Violent extremism or terrorism'],
  [/\bincite\b.{0,20}\b(violence|genocide|hatred)\b/i, 'Incitement to violence or hatred'],
];

/**
 * Screen a prompt + lyrics pair against the MiniMax Acceptable Use Policy before
 * any GPU time is spent. Returns the reason a request is refused, or null.
 */
export function screenAuroraRequest(prompt: string, lyrics: string): string | null {
  const text = `${prompt || ''}\n${lyrics || ''}`;
  for (const [pattern, reason] of AUP_PATTERNS) {
    if (pattern.test(text)) return reason;
  }
  return null;
}

// Submit a render. Throws on any transport or contract failure so a half-accepted
// submit can never be reported to the creator as running.
export async function submitAuroraJob({
  prompt, lyrics, duration, seed,
}: {
  prompt: string; lyrics?: string; duration: number; seed?: number;
}) {
  const body = {
    prompt,
    lyrics: lyrics || '',
    duration,
    // Sent explicitly so the Space never falls back to its own default budget.
    max_new_tokens: Math.round(duration * AURORA_FRAMES_PER_SECOND),
    seed,
    response_format: 'wav',
  };
  const res = await fetch(`${ENGINE_BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Aurora engine HTTP ${res.status}${t ? `: ${t.slice(0, 200)}` : ''}`);
  }
  const data = await res.json().catch(() => null);
  const jobId = data?.task_id || data?.job_id;
  if (!jobId) throw new Error('Aurora accepted the request but returned no task_id');
  return { jobId };
}

// One status read, normalized. 'lost' is its own state: the Space stores job
// records on a persistent /data mount, so a record that has genuinely vanished
// means the job predates persistence or the record was cleared — either way it is
// terminal, and treating it as transient would spin the poller forever.
export async function getAuroraStatus(jobId: string) {
  const res = await fetch(`${ENGINE_BASE}/status/${jobId}`, {
    signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
  });
  if (res.status === 404) return { status: 'lost', progress: '', error: '', downloadUrl: '', filename: '' };
  if (!res.ok) throw new Error(`Aurora status HTTP ${res.status}`);
  const data = await res.json().catch(() => null);
  if (!data) throw new Error('Aurora status returned no body');
  return {
    status: String(data.status || '').toLowerCase(),
    progress: data.progress || '',
    error: data.error || '',
    downloadUrl: String(data.result_url || data.download_url || data.file_url || ''),
    filename: String(data.filename || ''),
  };
}

// Read the RIFF/WAVE format block. Chunks are WALKED, never assumed to start at
// offset 12: soundfile writes a JUNK padding chunk before 'fmt ', and a
// fixed-offset read lands inside its zero fill and reports a 0Hz file.
export function readWavFormat(bytes: Uint8Array) {
  const miss = { sampleRate: null, channels: null, bitDepth: null, dataBytes: null };
  try {
    if (bytes.length < 44) return miss;
    const tag = (o: number) => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
    if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return miss;
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let off = 12, fmt = null, dataBytes = null;
    while (off + 8 <= bytes.length) {
      const id = tag(off);
      const size = dv.getUint32(off + 4, true);
      if (id === 'fmt ' && off + 8 + 16 <= bytes.length) {
        fmt = {
          channels: dv.getUint16(off + 10, true),
          sampleRate: dv.getUint32(off + 12, true),
          bitDepth: dv.getUint16(off + 22, true),
        };
      } else if (id === 'data') {
        dataBytes = Math.min(size, bytes.length - (off + 8));
        break;
      }
      off += 8 + size + (size % 2);
    }
    if (!fmt) return miss;
    return { ...fmt, dataBytes };
  } catch {
    return miss;
  }
}

// Peak amplitude of 16-bit PCM, 0 = digital silence. A size floor alone cannot
// tell a real song from a silent placeholder, and a placeholder that reached the
// library would be charged for, marked, and anchored as the creator's work.
function wavPeakAmplitude(bytes: Uint8Array): number | null {
  try {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tag = (o: number) => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
    if (bytes.length < 44 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null;
    let off = 12, dataOff = -1, dataSize = 0, depth = 0;
    while (off + 8 <= bytes.length) {
      const id = tag(off), sz = dv.getUint32(off + 4, true);
      if (id === 'fmt ') depth = dv.getUint16(off + 22, true);
      if (id === 'data') { dataOff = off + 8; dataSize = sz; break; }
      off += 8 + sz + (sz % 2);
    }
    if (dataOff < 0 || depth !== 16) return null;
    const end = Math.min(dataOff + dataSize, bytes.length);
    let peak = 0;
    for (let i = dataOff; i + 1 < end; i += 2) {
      const v = Math.abs(dv.getInt16(i, true));
      if (v > peak) peak = v;
    }
    return peak;
  } catch {
    return null;
  }
}

// Fetch the finished WAV and copy it into Base44 storage immediately — Space
// storage is ephemeral from the player's point of view, so an hf.space link must
// never reach a creator's library. Throws on silence or a badly truncated render.
export async function persistAuroraWav(base44, downloadUrl: string, name: string, requestedDuration = 0) {
  const url = /^https?:/i.test(downloadUrl)
    ? downloadUrl
    : `${ENGINE_BASE}${downloadUrl.startsWith('/') ? '' : '/'}${downloadUrl}`;
  const f = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!f.ok) throw new Error(`Aurora output fetch HTTP ${f.status}`);
  const blob = await f.blob();
  if (blob.size < 10000) throw new Error('Aurora output too small to be audio');
  const buf = new Uint8Array(await blob.arrayBuffer());
  const format = readWavFormat(buf);

  if (wavPeakAmplitude(buf) === 0) {
    throw new Error('Aurora returned a silent file — the engine reported success but rendered no audio.');
  }
  if (format.sampleRate && format.channels && format.bitDepth) {
    const frameBytes = format.channels * (format.bitDepth / 8);
    const seconds = (format.dataBytes ?? Math.max(0, buf.length - 44)) / frameBytes / format.sampleRate;
    if (requestedDuration > 0 && seconds < Math.min(15, requestedDuration * 0.4)) {
      throw new Error(`Aurora returned ${seconds.toFixed(1)}s of audio for a ${requestedDuration}s request — the engine did not complete a full render.`);
    }
  }
  const safeName = (name || 'aurora').replace(/[^\w.\-]/g, '_').slice(0, 60) || 'aurora';
  const file = new File([buf], `${safeName}.wav`, { type: 'audio/wav' });
  const up = await base44.integrations.Core.UploadFile({ file });
  if (!up?.file_url) throw new Error('Aurora output could not be persisted');
  return { fileUrl: up.file_url, ...format };
}

// Current credit balance (service-role read).
export async function auroraBalance(base44, userId: string) {
  const recs = await base44.asServiceRole.entities.UserCredit.filter({ user_id: userId });
  return { record: recs[0] || null, balance: recs[0]?.balance ?? 0 };
}

// Deduct on completion only — a render that never finished is free.
export async function auroraDeduct(base44, user, amount: number, jobId: string) {
  const recs = await base44.asServiceRole.entities.UserCredit.filter({ user_id: user.id });
  const record = recs[0];
  if (!record) return 0;
  const newBalance = Math.max(0, (record.balance || 0) - amount);
  await base44.asServiceRole.entities.UserCredit.update(record.id, {
    balance: newBalance,
    lifetime_spent: (record.lifetime_spent || 0) + amount,
    monthly_used: (record.monthly_used || 0) + amount,
  });
  await base44.asServiceRole.entities.CreditLog.create({
    user_id: user.id, user_email: user.email,
    transaction_type: 'generation',
    amount: -amount,
    balance_before: record.balance,
    balance_after: newBalance,
    related_job_id: jobId, provider: 'aurora',
    description: 'Aurora (MiniMax-Music3) song generation',
  }).catch(() => {});
  return newBalance;
}