import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { submitTranscript, pollTranscript, getTranscript } from '../../shared/assemblyai.ts';

/**
 * ORVO Studio episode transcription via AssemblyAI.
 *
 * Payload:
 *   { audio_url: string, episode_id?: string }  → submits + polls (~50s budget)
 *   { transcript_id: string, episode_id?: string } → continues polling an in-flight job
 *
 * Returns { status: 'completed'|'processing'|'error', transcript_id, text? }.
 * When completed with episode_id, the transcript is saved onto the Episode.
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = secrets.get('ASSEMBLYAI_API_KEY');
    if (!apiKey) return Response.json({ error: 'ASSEMBLYAI_API_KEY not configured' }, { status: 500 });

    const { audio_url, transcript_id, episode_id } = await req.json();
    if (!audio_url && !transcript_id) {
      return Response.json({ error: 'audio_url or transcript_id required' }, { status: 400 });
    }

    let id = transcript_id;
    if (!id) {
      id = await submitTranscript(apiKey, audio_url);
    }

    const data = transcript_id
      ? await getTranscript(apiKey, id)
      : await pollTranscript(apiKey, id);

    if (data.status === 'error') {
      return Response.json({ status: 'error', transcript_id: id, error: data.error }, { status: 502 });
    }
    if (data.status !== 'completed') {
      return Response.json({ status: 'processing', transcript_id: id });
    }

    // Persist onto the episode (owner-scoped — RLS enforces ownership)
    if (episode_id) {
      await base44.entities.Episode.update(episode_id, { transcript: data.text || '' });
    }

    return Response.json({ status: 'completed', transcript_id: id, text: data.text || '' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}