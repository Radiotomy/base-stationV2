// Scribe score engine config + client — audio → lead sheet (ABC), MIDI and timed
// key/chord/structure annotations, self-hosted on our Hugging Face Space.
//
// LICENCE: every component is permissive (Basic Pitch Apache-2.0, beat_this MIT,
// BTC MIT, librosa ISC), so output is commercially usable. Replaces SheetSage2
// (CC-BY-NC-4.0).

export const SCORE_ENGINE_URL = (Deno.env.get('SCORE_ENGINE_URL') || 'https://radiotomy-scribe.hf.space').replace(/\/$/, '');
export const SCORE_ENGINE = 'scribe';
export const SCORE_MODEL_ID = 'scribe-v1 (basic-pitch + beat_this + BTC)';
export const SCORE_LICENSE = 'Apache-2.0 / MIT';
export const SCORE_AUDIO_TYPES = ['track', 'stem', 'master', 'mashup', 'harmony', 'loop', 'sfx'];

/**
 * Sends the audio by URL (the Space downloads it itself): backend functions
 * can't reliably POST multi-MB WAV bodies, so the engine fetches the file.
 */
export async function transcribeScore(audioUrl: string, { melodyOnly = false, title = '' } = {}) {
  const form = new FormData();
  form.append('audio_url', audioUrl);
  form.append('melody_only', melodyOnly ? 'true' : 'false');
  if (title) form.append('title', title);

  const res = await fetch(`${SCORE_ENGINE_URL}/transcribe`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(280_000),
  });
  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { /* non-JSON = Space asleep/building */ }

  if (!res.ok || !data) {
    const detail = data?.detail || data?.error;
    if (res.status === 503 || !data) {
      throw new Error(detail || 'The score engine is waking up — try again in a few minutes.');
    }
    throw new Error(detail || `Score engine error (${res.status})`);
  }
  return data;
}