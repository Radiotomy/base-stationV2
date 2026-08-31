// Skye — our open-source fork of DiffRhythm 2, self-hosted on a Hugging Face
// Space (huggingface.co/spaces/Radiotomy/Skye). Async submit-and-poll, the same
// architectural shape as Siren Song and Coda, but a COMPLETELY different model
// with a different conditioning contract.
//
//   POST /generate/audio  { lyrics, style_prompt, negative_style_prompt,
//                           reference_audio_url, duration, seed }
//        → { status: "accepted", job_id }
//   GET  /status/{job_id}
//        → { status: pending|processing|completed|failed, progress,
//            download_url?, filename?, file_path? }
//   GET  {BASE}{download_url}
//        → the rendered WAV
//
// Conditioning notes that drive the UI and the sanitizing below:
//   style_prompt          — PROSE, not comma tokens. DiffRhythm 2 steers on a
//                           natural-language description of the production.
//                           (This is the opposite of Siren Song's tag channel —
//                           feeding tags here wastes the model's text encoder.)
//   negative_style_prompt — what to steer AWAY from. Distinct channel, so a
//                           creator never has to phrase a negative as a positive.
//   lyrics                — raw OR LRC-timestamped ("[00:12.50] line"). The fork
//                           does phonetic alignment, so timestamps are optional
//                           and are passed through untouched when present.
//   reference_audio_url   — zero-shot style cloning. The Space downloads the URL
//                           itself and cleans up its own temp file, so we only
//                           ever hand it a public https URL, never file bytes.

const ENGINE_BASE = 'https://radiotomy-skye.hf.space';

// Generous, because a Space that has scaled to zero (or just had its GPU
// changed) has to cold-start before it can even acknowledge a submit. A tight
// timeout here reports "engine down" for a Space that was merely waking up.
const SUBMIT_TIMEOUT_MS = 90000;
const STATUS_TIMEOUT_MS = 15000;
// Long-form output means a much larger WAV than Siren Song's 60s ceiling.
const DOWNLOAD_TIMEOUT_MS = 180000;

// The fork's validated long-form window, in seconds. DiffRhythm *1* generated up
// to 285s, and the upstream playground slider still advertises that — but
// DiffRhythm *2* (what this fork is built on) trades that ceiling for structural
// coherence and is only validated to 210s. Rendering past 210s produces audio
// that drifts structurally, so the ceiling tracks the MODEL we actually run, not
// the number inherited from v1.
export const SKYE_MIN_DURATION = 95;
export const SKYE_MAX_DURATION = 210;
export const SKYE_DEFAULT_DURATION = 95;

// Cost of one Skye generation, in credits. Above Siren Song (12) because the
// long-form window is nearly 5x the GPU time for a full-length render.
export const SKYE_COST = 14;

// DiffRhythm 2's real steering controls, verified against upstream inference.py.
// There is NO negative-prompt channel in the model — style is a single MuLan
// embedding from either text or audio — so classifier-free guidance strength is
// the only steering dial besides the prompt itself.
//
// cfg_strength 2.0 and 16 sampling steps are upstream's own CLI defaults.
export const SKYE_CFG_STRENGTH = 2.0;
export const SKYE_SAMPLE_STEPS = 16;

// Sweep bounds, mirroring the clamps the Space enforces. Kept here so a caller
// is corrected before spending GPU time rather than silently after it.
export const SKYE_CFG_RANGE = { min: 1.0, max: 8.0 };
export const SKYE_STEPS_RANGE = { min: 8, max: 64 };

// Submit a job. Throws on any transport or contract failure so the caller can
// surface a clean 502 — a submit that half-succeeds must never look accepted.
//
// Contract of the REBUILT Space (2026-08-30, verified against its live
// /openapi.json): POST /generate { prompt, lyrics, style, duration, seed }
// → { task_id, status }. cfg/steps are fixed inside the Space now, and
// reference-audio cloning is not exposed — the caller must reject a reference
// rather than send one the engine would silently ignore.
// cfgStrength / sampleSteps are OPTIONAL and exist for calibration sweeps only.
// Omitting them sends nothing, so the Space applies its own defaults and normal
// creator generation is byte-for-byte unchanged — a tuning dial must never
// quietly become part of the paid path before it has been measured.
export async function submitSkyeAudio({
  lyrics, stylePrompt, duration, seed, cfgStrength, sampleSteps,
}: {
  lyrics?: string; stylePrompt: string; duration: number; seed?: number;
  cfgStrength?: number; sampleSteps?: number;
}) {
  const body: Record<string, unknown> = {
    prompt: stylePrompt,
    // `style` has a server-side default of "rock" — always sent explicitly so
    // an omitted field can never inject a genre the creator didn't ask for.
    style: '',
    lyrics: lyrics && lyrics.trim() ? lyrics : '[instrumental]',
    duration,
    seed,
  };
  if (cfgStrength !== undefined) {
    body.cfg_strength = Math.max(SKYE_CFG_RANGE.min, Math.min(cfgStrength, SKYE_CFG_RANGE.max));
  }
  if (sampleSteps !== undefined) {
    body.sample_steps = Math.round(Math.max(SKYE_STEPS_RANGE.min, Math.min(sampleSteps, SKYE_STEPS_RANGE.max)));
  }

  const res = await fetch(`${ENGINE_BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Skye engine HTTP ${res.status}${t ? `: ${t.slice(0, 200)}` : ''}`);
  }
  const data = await res.json().catch(() => null);
  const jobId = data?.task_id || data?.job_id;
  if (!jobId) throw new Error('Skye accepted the request but returned no task_id');
  return { jobId };
}

// One status read. Normalizes the engine's field names into a stable shape.
export async function getSkyeStatus(jobId) {
  const res = await fetch(`${ENGINE_BASE}/status/${jobId}`, {
    signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Skye status HTTP ${res.status}`);
  const data = await res.json().catch(() => null);
  if (!data) throw new Error('Skye status returned no body');
  return {
    status: String(data.status || '').toLowerCase(),
    progress: data.progress || '',
    error: data.error || '',
    // result_url is the rebuilt Space's field; the older names are kept as
    // fallbacks so an engine rollback degrades to working rather than breaking.
    downloadUrl: String(data.result_url || data.download_url || data.file_url || data.url || ''),
    filename: String(data.filename || ''),
  };
}

// Read the format block out of a RIFF/WAVE header. The sample rate is
// load-bearing for BASE Mark: the V2 detector currently cannot recover a mark
// from a 48kHz master, so whether a track may be watermarked is decided by the
// MEASURED rate rather than an assumption about what the model emits. Returns
// nulls for anything that isn't a WAVE container instead of throwing — an
// unreadable header must not fail a render that already succeeded.
export function readWavFormat(bytes: Uint8Array) {
  const miss = { sampleRate: null, channels: null, bitDepth: null, dataBytes: null };
  try {
    if (bytes.length < 44) return miss;
    const tag = (o: number) => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
    if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return miss;
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    // Chunks MUST be walked, never assumed to start at offset 12. Skye's engine
    // writes via soundfile, which emits a 52-byte JUNK padding chunk BEFORE
    // 'fmt ' — so the old fixed-offset read (22/24/34) landed inside JUNK's zero
    // fill and reported a 0Hz, 0-channel, 0-bit file for every single render.
    // That silently disabled the 48kHz BASE Mark guard below, which is the whole
    // reason this reader exists.
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
        // Trust the smaller of declared vs actual: a truncated download must not
        // report the duration the header claims it should have had.
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

// Peak amplitude of a 16-bit PCM WAV, 0 = digital silence. A byte-size check
// alone cannot tell a real render from a placeholder: a 1-second silent stub is
// ~88KB and sails past any size floor. Returns null when the container isn't
// 16-bit PCM, so an unmeasurable file is never treated as proof of silence.
function wavPeakAmplitude(bytes: Uint8Array): number | null {
  try {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tag = (o: number) => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
    if (bytes.length < 44 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null;
    if (dv.getUint16(34, true) !== 16) return null;
    let off = 12, dataOff = -1, dataSize = 0;
    while (off + 8 <= bytes.length) {
      const id = tag(off), sz = dv.getUint32(off + 4, true);
      if (id === 'data') { dataOff = off + 8; dataSize = sz; break; }
      off += 8 + sz + (sz % 2);
    }
    if (dataOff < 0) return null;
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

// Fetch the finished WAV and copy it into Base44 storage immediately: Space
// storage is ephemeral, so an hf.space link must never be handed to the player.
// Returns the stored URL plus the measured format, so the caller never has to
// assume the engine's output rate.
//
// Throws on a silent or implausibly short render. The Space can report
// 'completed' while having written only a placeholder stub, and a job that
// persisted that stub would charge the creator, save silence to their library
// and hand it to the BASE Mark cascade — so a stub must fail the job loudly
// rather than be dressed up as a finished track.
export async function persistSkyeWav(base44, downloadUrl, name, requestedDuration = 0) {
  const url = /^https?:/i.test(downloadUrl)
    ? downloadUrl
    : `${ENGINE_BASE}${downloadUrl.startsWith('/') ? '' : '/'}${downloadUrl}`;
  const f = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!f.ok) throw new Error(`Skye output fetch HTTP ${f.status}`);
  const blob = await f.blob();
  if (blob.size < 10000) throw new Error('Skye output too small to be audio');
  const safeName = (name || 'skye').replace(/[^\w.\-]/g, '_').slice(0, 60) || 'skye';
  const buf = new Uint8Array(await blob.arrayBuffer());
  const format = readWavFormat(buf);

  const peak = wavPeakAmplitude(buf);
  if (peak === 0) {
    throw new Error('Skye returned a silent file — the engine reported success but rendered no audio. The Space is likely running a placeholder handler rather than the loaded DiffRhythm 2 model.');
  }
  // A render far shorter than asked for is the same stub failure wearing a
  // different size. Only enforced when the rate is actually readable.
  if (format.sampleRate && format.channels && format.bitDepth) {
    const frameBytes = format.channels * (format.bitDepth / 8);
    // Measured from the data chunk, not `buf.length - 44`: the header is not a
    // fixed 44 bytes (soundfile prepends a 52-byte JUNK chunk), so the old
    // arithmetic silently over-reported duration by whatever the real header cost.
    const seconds = (format.dataBytes ?? Math.max(0, buf.length - 44)) / frameBytes / format.sampleRate;
    if (requestedDuration > 0 && seconds < Math.min(10, requestedDuration * 0.5)) {
      throw new Error(`Skye returned ${seconds.toFixed(1)}s of audio for a ${requestedDuration}s request — the engine did not perform a full render.`);
    }
  }
  const file = new File([buf], `${safeName}.wav`, { type: 'audio/wav' });
  const up = await base44.integrations.Core.UploadFile({ file });
  if (!up?.file_url) throw new Error('Skye output could not be persisted');
  return { fileUrl: up.file_url, ...format };
}

// Current credit balance (service-role read).
export async function skyeBalance(base44, userId) {
  const recs = await base44.asServiceRole.entities.UserCredit.filter({ user_id: userId });
  return { record: recs[0] || null, balance: recs[0]?.balance ?? 0 };
}

// Deduct on completion — never on submit — so a job that never renders is free.
export async function skyeDeduct(base44, user, amount, jobId) {
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
    related_job_id: jobId, provider: 'skye',
    description: 'Skye (DiffRhythm 2) audio generation',
  }).catch(() => {});
  return newBalance;
}