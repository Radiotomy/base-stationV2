/**
 * Cadence — our self-hosted chord-conditioned instrumental bed engine.
 *
 * HF Space: radiotomy/cadence. Reference implementation and the full rationale live
 * in src/docs/cadence-musicgen-chord/.
 *
 * Replaces the Replicate `sakemin/musicgen-chord` deployment. The move was not about
 * per-call price: MusicGen-Chord needs NO fine-tuned checkpoint (it is a multi-hot
 * chroma trick on stock musicgen-melody weights, arXiv:2412.00325), so self-hosting
 * costs nothing extra on GPU we already rent, and it puts the chord vocabulary,
 * voicing and bar subdivision in our own source where they can be tuned and trained
 * — none of which was reachable behind a fixed Replicate model version.
 *
 * Lifecycle matches Sever and Cantor: submit returns a job id, the caller polls. The
 * engine runs ONE render at a time (concurrent requests against a single CUDA-resident
 * model raise "Cannot copy out of meta tensor"), so a queued job waits rather than fails.
 */

const CADENCE_HOST = 'https://radiotomy-cadence.hf.space';

export const CADENCE_ENGINE = 'cadence/musicgen-chord';

/**
 * MusicGen's native window is 30s; past that audiocraft extends by sliding-window
 * continuation and adherence to the STATED progression degrades as context slides.
 * 120s is where it stops being worth charging for.
 */
export const MAX_BED_SECONDS = 120;

export interface CadenceRequest {
  /** Instrumentation and feel only — never chord names; they fight the conditioning. */
  prompt: string;
  /** Harte ROOT:TYPE, space-separated bars. Use normalizeChordChart() first. */
  text_chords: string;
  bpm: number;
  time_sig: string;
  duration: number;
}

export interface CadenceStatus {
  status: 'processing' | 'completed' | 'failed' | 'not_found';
  audio?: string;
  duration?: number;
  error?: string;
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  // Only needed if the Space is set private; harmless when public.
  const token = Deno.env.get('HF_TOKEN');
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export async function submitBed(req: CadenceRequest): Promise<string> {
  const res = await fetch(`${CADENCE_HOST}/generate`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      prompt: req.prompt,
      text_chords: req.text_chords,
      bpm: req.bpm,
      time_sig: req.time_sig,
      duration: Math.min(Math.max(Math.round(req.duration), 8), MAX_BED_SECONDS),
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Cadence engine error (${res.status}): ${text.slice(0, 300)}`);
  }

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    // A cold or rebuilding Space serves an HTML holding page, not JSON.
    throw new Error('Cadence engine is starting up — try again in a moment.');
  }
  if (data.error) throw new Error(data.error);
  if (!data.job_id) throw new Error('Cadence engine returned no job id');
  return data.job_id;
}

export async function pollBed(jobId: string): Promise<CadenceStatus> {
  const res = await fetch(`${CADENCE_HOST}/status/${jobId}`, { headers: headers() });
  if (!res.ok) {
    // Treated as still-running: a transient 5xx from a warming Space must not be
    // reported to a creator as a failed render.
    return { status: 'processing' };
  }
  try {
    return await res.json();
  } catch {
    return { status: 'processing' };
  }
}

/** The engine returns a relative /outputs path. */
export function resolveAudioUrl(audio: string): string {
  if (!audio) return '';
  return audio.startsWith('http') ? audio : `${CADENCE_HOST}${audio}`;
}

export async function cadenceHealth(): Promise<any> {
  try {
    const res = await fetch(`${CADENCE_HOST}/health`, { headers: headers() });
    if (!res.ok) return { status: 'unavailable', code: res.status };
    return await res.json();
  } catch (e) {
    return { status: 'unavailable', error: (e as Error).message };
  }
}