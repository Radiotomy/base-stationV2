import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

/**
 * ORVO Studio — unified voice catalog.
 *
 * Payload: { provider: 'inworld' | 'elevenlabs' }
 * Returns: { provider, voices: [{ id, name, description, gender, age, accent, language, use_case, preview_url }] }
 *
 * Normalizes both providers into one shape so the picker can render a single
 * browse/preview UI. preview_url is only present when the provider hosts its
 * own sample (ElevenLabs); Inworld samples are synthesized on demand by the
 * previewVoice function.
 */
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { provider = 'inworld' } = await req.json();

    if (provider === 'inworld') {
      const key = secrets.get('INWORLD_API_KEY');
      if (!key) return Response.json({ error: 'INWORLD_API_KEY not configured' }, { status: 500 });

      const res = await fetch('https://api.inworld.ai/tts/v1/voices', {
        headers: { Authorization: `Basic ${key}` },
      });
      if (!res.ok) {
        const err = await res.text();
        return Response.json({ error: `Inworld voice list failed (${res.status}): ${err.slice(0, 300)}` }, { status: 502 });
      }
      const json = await res.json();
      const raw = json.voices || json.result?.voices || [];
      const voices = raw.map((v) => ({
        id: v.voiceId || v.voice_id || v.name,
        name: v.displayName || v.display_name || v.voiceId || v.name,
        description: v.description || '',
        gender: (v.gender || '').toLowerCase(),
        age: v.age || '',
        accent: v.accent || '',
        language: Array.isArray(v.languages) ? v.languages.join(', ') : (v.language || ''),
        use_case: v.useCase || v.use_case || '',
        preview_url: v.previewUrl || v.sampleUrl || '',
      }));
      return Response.json({ provider: 'inworld', voices });
    }

    const elKey = secrets.get('ELEVENLABS_API');
    if (!elKey) return Response.json({ error: 'ELEVENLABS_API not configured' }, { status: 500 });

    const elRes = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': elKey } });
    if (!elRes.ok) {
      const err = await elRes.text();
      return Response.json({ error: `ElevenLabs voice list failed (${elRes.status}): ${err.slice(0, 300)}` }, { status: 502 });
    }
    const elJson = await elRes.json();
    const voices = (elJson.voices || []).map((v) => ({
      id: v.voice_id,
      name: v.name,
      description: v.description || v.labels?.description || '',
      gender: (v.labels?.gender || '').toLowerCase(),
      age: v.labels?.age || '',
      accent: v.labels?.accent || '',
      language: v.labels?.language || '',
      use_case: v.labels?.use_case || v.labels?.['use case'] || '',
      preview_url: v.preview_url || '',
    }));
    return Response.json({ provider: 'elevenlabs', voices });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}