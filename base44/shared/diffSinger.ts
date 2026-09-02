/**
 * Cantor — BASE Station's own singing-voice synthesis engine.
 *
 * DiffSinger (Apache-2.0 fork) on our self-hosted Hugging Face Space. This is the
 * only engine on the platform that sings a HUMAN-AUTHORED melody: it takes a
 * syllable/pitch/duration score plus a voicebank and renders vocals that follow
 * those exact notes. Every other vocal path we run infers a melody from a prompt.
 *
 * Load-bearing consequences:
 *
 * * A Cantor render's vocal line is authored, not generated, so its provenance
 *   points at a LeadSheet rather than at prompt telemetry. The engine must never
 *   be allowed to "improve" the melody — a re-pitched output would quietly break
 *   the authorship claim the score exists to make.
 *
 * * ASYNCHRONOUS submit-and-poll, same lifecycle as Sever/Skye/Coda/Siren Song.
 *   Diffusion vocal rendering on CPU runs minutes; an inline request would die at
 *   the gateway long before the render finished.
 *
 * * ONE JOB AT A TIME on the Space by design. A 'queued' status is normal and must
 *   be reported as 'processing' — the concurrency crashes Coda and Siren Song earn
 *   from parallel weight loading are the exact failure being avoided here.
 *
 * * Voicebanks are INSTALLED ON THE SPACE, not shipped with this code. The engine
 *   is useless without one, and each bank carries its own licence, so the set of
 *   available banks is discovered at runtime rather than hardcoded here.
 */

const CANTOR_HOST = 'https://radiotomy-cantor.hf.space';

export const CANTOR_ENGINE = 'diffsinger';

const SUBMIT_TIMEOUT_MS = 60_000;
const STATUS_TIMEOUT_MS = 30_000;

export interface CantorNote {
  syllable: string;
  midi: number;
  beats: number;
}

export interface CantorStatus {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  audio_url?: string;
  error?: string;
  sample_rate?: number;
  voicebank?: string;
  duration_seconds?: number;
}

export interface CantorVoicebank {
  id: string;
  name: string;
  language?: string;
  license?: string;
  /** Whether the bank exposes the ONNX models Cantor needs to render at all. */
  renderable?: boolean;
}

/**
 * Voicebanks currently installed on the engine.
 *
 * Returns [] rather than throwing when the Space is asleep: an empty picker with a
 * "warming up" hint is recoverable, an exception on page load is not.
 */
export async function listVoicebanks(): Promise<CantorVoicebank[]> {
  try {
    const res = await fetch(`${CANTOR_HOST}/voicebanks`, {
      signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.voicebanks) ? data.voicebanks : [];
  } catch {
    return [];
  }
}

/** Submit a vocal render. Returns the engine's job id. */
export async function submitCantorJob(params: {
  voicebank: string;
  bpm: number;
  notes: CantorNote[];
}): Promise<string> {
  const res = await fetch(`${CANTOR_HOST}/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      voicebank: params.voicebank,
      bpm: params.bpm,
      notes: params.notes,
    }),
    signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Cantor engine rejected the render (${res.status})`);
  const data = await res.json();
  if (data?.error) throw new Error(data.error);
  if (!data?.job_id) throw new Error('Cantor engine returned no job id');
  return data.job_id;
}

export async function getCantorStatus(jobId: string): Promise<CantorStatus | null> {
  try {
    const res = await fetch(`${CANTOR_HOST}/status/${jobId}`, {
      signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.error && !data?.status) return null;
    return {
      status: data.status,
      audio_url: data.audio_url,
      error: data.error,
      sample_rate: data.sample_rate,
      voicebank: data.voicebank,
      duration_seconds: data.duration_seconds,
    };
  } catch {
    // A cold or restarting Space is not a failed render — keep polling.
    return null;
  }
}

/** The engine returns paths like '/outputs/abc.wav'. */
export function absoluteCantorUrl(path: string): string {
  if (!path) return '';
  return path.startsWith('http') ? path : `${CANTOR_HOST}${path}`;
}

/**
 * Ask the engine to download, validate and install a bank (or a shared vocoder).
 *
 * The engine authenticates the caller by asking Hugging Face who the token
 * belongs to — only the Space owner's token passes, so this is only ever called
 * from a backend function that already gated the request itself.
 */
export async function submitCantorInstall(params: {
  bankId: string;
  zipUrl: string;
  kind: 'voicebank' | 'vocoder';
  replace?: boolean;
  hfToken: string;
}): Promise<string> {
  const res = await fetch(`${CANTOR_HOST}/install`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${params.hfToken}` },
    body: JSON.stringify({
      bank_id: params.bankId,
      zip_url: params.zipUrl,
      kind: params.kind,
      replace: Boolean(params.replace),
    }),
    signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) throw new Error(data?.error || `Cantor engine refused the install (${res.status})`);
  if (!data?.job_id) throw new Error('Cantor engine returned no install job id');
  return data.job_id;
}

/** Install job status. Same shape as a render status plus `stage` and `report`. */
export async function getCantorInstallStatus(jobId: string): Promise<any | null> {
  try {
    const res = await fetch(`${CANTOR_HOST}/status/${jobId}`, { signal: AbortSignal.timeout(STATUS_TIMEOUT_MS) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.error && !data?.status) return null;
    return data;
  } catch {
    return null;
  }
}

export async function removeCantorVoicebank(bankId: string, hfToken: string): Promise<void> {
  const res = await fetch(`${CANTOR_HOST}/voicebanks/${encodeURIComponent(bankId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${hfToken}` },
    signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
  });
  if (!res.ok && res.status !== 404) throw new Error(`Cantor engine refused the removal (${res.status})`);
}

export async function cantorHealth(): Promise<any> {
  const res = await fetch(`${CANTOR_HOST}/health`, {
    signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Cantor health check failed (${res.status})`);
  return await res.json();
}