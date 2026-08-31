/**
 * MusicGen-Chord — chord-conditioned instrumental beds.
 *
 * sakemin/musicgen-chord on Replicate. This is the one generation model we run that
 * takes a LITERAL chord progression ('C | G:7 | E:min | A:min') plus BPM and time
 * signature and conditions on them, rather than inferring harmony from a prose
 * prompt. That is exactly what a lead sheet needs: the writer's progression must
 * survive into the audio, or the score was decorative.
 *
 * Load-bearing choices:
 *
 * * CALLED BY MODEL PATH, NOT VERSION HASH. The /models/{owner}/{name}/predictions
 *   endpoint always runs the model's current version. A pinned hash would be the
 *   faster path, but a stale or mistyped hash fails every call with an opaque 404 —
 *   and we have no way to verify a hash from inside this runtime.
 *
 * * PROMPT DESCRIBES INSTRUMENTATION ONLY. Harmony comes from text_chords; putting
 *   chord names in the prose prompt as well makes the model fight itself.
 *
 * * NO VOCALS. MusicGen is instrumental. The sung line comes from Cantor
 *   (base44/shared/diffSinger.ts) and the two are combined in SUB-Station — which
 *   is also what keeps their provenance separable: an authored melody and an
 *   AI-arranged bed are different authorship claims and must not be merged into one.
 */

const MODEL_PATH = 'sakemin/musicgen-chord';

export const MUSICGEN_CHORD_MODEL = MODEL_PATH;

/** Longer than this and the model loses the progression's shape. */
export const MAX_BED_SECONDS = 120;

export interface BedInput {
  /** Instrumentation and feel — never chord names. */
  prompt: string;
  /** The progression as authored, e.g. 'C | Am | F | G7'. */
  text_chords: string;
  bpm: number;
  time_sig: string;
  duration: number;
}

function token(): string {
  const t = Deno.env.get('REPLICATE_API_TOKEN');
  if (!t) throw new Error('REPLICATE_API_TOKEN is not set');
  return t;
}

/**
 * Start a bed render. Waits briefly, then hands back whatever state the prediction
 * is in — a short bed often settles inside the wait, a long one does not, and the
 * caller polls either way.
 */
export async function startBed(input: BedInput): Promise<any> {
  const res = await fetch(`https://api.replicate.com/v1/models/${MODEL_PATH}/predictions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token()}`,
      'Content-Type': 'application/json',
      Prefer: 'wait=55',
    },
    body: JSON.stringify({
      input: {
        prompt: input.prompt,
        text_chords: input.text_chords,
        bpm: input.bpm,
        time_sig: input.time_sig,
        duration: Math.min(Math.max(Math.round(input.duration), 8), MAX_BED_SECONDS),
        output_format: 'wav',
        // Chroma conditioning is what makes the progression stick; without it the
        // model treats text_chords as a loose hint.
        multi_band_diffusion: false,
        normalization_strategy: 'peak',
      },
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.detail || data?.error || JSON.stringify(data);
    throw new Error(`MusicGen-Chord error (${res.status}): ${msg}`);
  }
  return data;
}

export async function getBedPrediction(id: string): Promise<any> {
  const r = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
    headers: { 'Authorization': `Bearer ${token()}` },
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.detail || data?.error || `Replicate poll error (${r.status})`);
  return data;
}

/** Normalize the model's `output` into one playable URL. */
export function extractBedUrl(output: any): string | null {
  if (!output) return null;
  if (Array.isArray(output)) return output[0] || null;
  if (typeof output === 'string') return output;
  return output.url || null;
}