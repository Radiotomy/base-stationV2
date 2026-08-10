import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { synthesizeInworldSpeech } from '../../shared/inworldTts.ts';

/**
 * ORVO live AI co-host turn — Phase 4.
 * The host sends a brief; the co-host writes a short spoken response, voices it
 * with Inworld TTS-2, and publishes it as a turn every listener receives live.
 *
 * Payload: { event_id, brief, voice_id?, speak_verbatim? }
 */
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { event_id, brief, voice_id, speak_verbatim } = await req.json();
    if (!event_id || !brief) return Response.json({ error: 'event_id and brief are required' }, { status: 400 });

    const events = await base44.asServiceRole.entities.OrvoLiveEvent.filter({ id: event_id });
    const event = events?.[0];
    if (!event) return Response.json({ error: 'Live event not found' }, { status: 404 });
    if (event.host_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Only the host can drive the co-host' }, { status: 403 });
    }
    if (event.status !== 'live') {
      return Response.json({ error: 'Event is not live' }, { status: 400 });
    }

    const apiKey = secrets.get('INWORLD_API_KEY');
    if (!apiKey) return Response.json({ error: 'INWORLD_API_KEY not configured' }, { status: 500 });

    let speech = brief;
    if (!speak_verbatim) {
      const recent = await base44.asServiceRole.entities.OrvoLiveTurn.filter({ event_id }, '-created_date', 4);
      const history = recent.reverse().map((t) => t.text).join('\n');
      const script = await base44.integrations.Core.InvokeLLM({
        prompt: `You are the AI co-host of a live podcast called "${event.title}". Speak in first person, conversationally, 2-4 sentences maximum. Output ONLY the words to be spoken — no labels, no stage directions.
${history ? `What you have already said this episode:\n${history}\n` : ''}
The host just asked you to cover: ${brief}`,
      });
      speech = typeof script === 'string' ? script.trim() : brief;
    }

    const bytes = await synthesizeInworldSpeech(apiKey, { text: speech, voiceId: voice_id || 'Ashley' });
    const file = new File([bytes], 'orvo-live-turn.mp3', { type: 'audio/mpeg' });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    const turn = await base44.asServiceRole.entities.OrvoLiveTurn.create({
      event_id,
      podcast_id: event.podcast_id,
      speaker: 'ai_cohost',
      text: speech,
      audio_url: file_url,
      voice_id: voice_id || 'Ashley',
    });

    return Response.json({ turn });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}