// SheetSage2 engine config + client — audio → lead sheet (ABC), MIDI and timed
// key/chord/structure annotations, self-hosted on our Hugging Face Space.
//
// LICENCE: m-a-p/SheetSage2 and its MERT-v2 parent are CC-BY-NC-4.0, so
// transcription is offered FREE (never billed) and labelled non-commercial.

export const SHEETSAGE_URL = (Deno.env.get('SHEETSAGE_ENGINE_URL') || 'https://radiotomy-sheetsage2.hf.space').replace(/\/$/, '');
export const SHEETSAGE_MODEL_ID = 'm-a-p/SheetSage2';
export const SHEETSAGE_LICENSE = 'CC-BY-NC-4.0';
export const SHEETSAGE_AUDIO_TYPES = ['track', 'stem', 'master', 'mashup', 'harmony', 'loop', 'sfx'];

/**
 * Sends the audio by URL (the Space downloads it itself): backend functions
 * can't reliably POST multi-MB WAV bodies, so the engine fetches the file.
 */
export async function transcribeWithSheetSage(audioUrl: string, { melodyOnly = false } = {}) {
  const form = new FormData();
  form.append('audio_url', audioUrl);
  form.append('melody_only', melodyOnly ? 'true' : 'false');

  const res = await fetch(`${SHEETSAGE_URL}/transcribe`, {
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