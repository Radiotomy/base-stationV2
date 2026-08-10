import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

/**
 * ORVO Studio — short voice audition.
 *
 * Payload: { provider, voice_id, text? }
 * Returns: { audio_data_url }  — a base64 data URL, NOT persisted as an asset,
 * so browsing the catalog never pollutes the user's ORVO library.
 */
const SAMPLE = 'Welcome back to the show — glad you could join us today.';
const MAX_PREVIEW_CHARS = 200;

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { provider = 'inworld', voice_id, text } = await req.json();
    if (!voice_id) return Response.json({ error: 'voice_id is required' }, { status: 400 });
    const sampleText = (text || SAMPLE).slice(0, MAX_PREVIEW_CHARS);

    if (provider === 'inworld') {
      const key = secrets.get('INWORLD_API_KEY');
      if (!key) return Response.json({ error: 'INWORLD_API_KEY not configured' }, { status: 500 });

      const res = await fetch('https://api.inworld.ai/tts/v1/voice', {
        method: 'POST',
        headers: { Authorization: `Basic ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sampleText, voiceId: voice_id, modelId: 'inworld-tts-1' }),
      });
      if (!res.ok) {
        const err = await res.text();
        return Response.json({ error: `Inworld preview failed (${res.status}): ${err.slice(0, 300)}` }, { status: 502 });
      }
      const json = await res.json();
      const b64 = json.audioContent || json.result?.audioContent;
      if (!b64) return Response.json({ error: 'Inworld returned no audio content' }, { status: 502 });
      return Response.json({ audio_data_url: `data:audio/mpeg;base64,${b64}` });
    }

    const elKey = secrets.get('ELEVENLABS_API');
    if (!elKey) return Response.json({ error: 'ELEVENLABS_API not configured' }, { status: 500 });

    const elRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice_id}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: { 'xi-api-key': elKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sampleText, model_id: 'eleven_multilingual_v2' }),
      }
    );
    if (!elRes.ok) {
      const err = await elRes.text();
      return Response.json({ error: `ElevenLabs preview failed (${elRes.status}): ${err.slice(0, 300)}` }, { status: 502 });
    }
    const bytes = new Uint8Array(await elRes.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return Response.json({ audio_data_url: `data:audio/mpeg;base64,${btoa(binary)}` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}