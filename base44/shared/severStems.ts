/**
 * Sever — BASE Station's own stem separation engine.
 *
 * HTDemucs-6s on our self-hosted Hugging Face Space (Radiotomy/Sever), replacing
 * the per-separation Tempolor API charge. Six stems instead of four: drums, bass,
 * other, vocals, GUITAR and PIANO.
 *
 * Asynchronous submit-and-poll, same lifecycle Skye/Siren Song/Coda use. This is
 * not a style choice: a CPU separation takes minutes, so an inline request would
 * time out at the gateway before the model finished.
 *
 * The Space runs ONE job at a time by design. A queued job is normal and must be
 * reported as 'processing', never as a failure.
 */

import { ensureAwake } from './hfWake.ts';
const SEVER_HOST = 'https://radiotomy-sever.hf.space';

export const SEVER_MODEL = 'htdemucs_6s';
export const SEVER_STEMS = ['drums', 'bass', 'other', 'vocals', 'guitar', 'piano'] as const;

// Valid UserAsset.stem_type enum values. 'guitar' and 'piano' have no enum slot,
// so they are filed with the schema's 'other' catch-all while keeping their true
// name in metadata — inventing an enum value would fail validation, and dropping
// the stems would throw away two of the six the model produces.
const STEM_TYPE_ENUM: Record<string, string> = {
  drums: 'drums',
  bass: 'bass',
  vocals: 'vocals',
  other: 'other',
  guitar: 'other',
  piano: 'other',
};

export function stemTypeFor(name: string): string {
  return STEM_TYPE_ENUM[name] || 'other';
}

const SUBMIT_TIMEOUT_MS = 60_000;
const STATUS_TIMEOUT_MS = 30_000;

export interface SeverStatus {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  stems: Record<string, string>;
  error?: string;
  sample_rate?: number;
}

/** Submit a separation. Returns the engine's job id. */
export async function submitSeverJob(audioUrl: string, stems?: string[]): Promise<string> {
  await ensureAwake(SEVER_HOST);
  const res = await fetch(`${SEVER_HOST}/separate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio_url: audioUrl, ...(stems?.length ? { stems } : {}) }),
    signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Sever engine rejected the job (${res.status})`);
  const data = await res.json();
  if (data?.error) throw new Error(data.error);
  if (!data?.job_id) throw new Error('Sever engine returned no job id');
  return data.job_id;
}

export async function getSeverStatus(jobId: string): Promise<SeverStatus | null> {
  try {
    const res = await fetch(`${SEVER_HOST}/status/${jobId}`, {
      signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.error && !data?.status) return null;
    return {
      status: data.status,
      stems: data.stems || {},
      error: data.error,
      sample_rate: data.sample_rate,
    };
  } catch {
    // A cold or restarting Space is not a failed job — keep polling.
    return null;
  }
}

/** The engine returns paths like '/outputs/abc_vocals.wav'. */
export function absoluteSeverUrl(path: string): string {
  if (!path) return '';
  return path.startsWith('http') ? path : `${SEVER_HOST}${path}`;
}

export async function severHealth(): Promise<any> {
  const res = await fetch(`${SEVER_HOST}/health`, { signal: AbortSignal.timeout(STATUS_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Sever health check failed (${res.status})`);
  return await res.json();
}