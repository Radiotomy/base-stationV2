import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { submitTranscript, pollTranscript, getTranscript } from '../../shared/assemblyai.ts';

/**
 * ORVO Studio auto-chapter generation via AssemblyAI (auto_chapters).
 *
 * Payload:
 *   { audio_url: string, episode_id?: string }  → submits + polls (~50s budget)
 *   { transcript_id: string, episode_id?: string } → continues polling
 *
 * Returns { status, transcript_id, chapters?: [{title, start_seconds}] }.
 * When completed with episode_id, chapters are saved onto the Episode.
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
      id = await submitTranscript(apiKey, audio_url, { auto_chapters: true });
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

    const chapters = (data.chapters || []).map((ch) => ({
      title: ch.headline || ch.gist || 'Chapter',
      start_seconds: Math.round((ch.start || 0) / 1000),
    }));

    if (episode_id) {
      await base44.entities.Episode.update(episode_id, { chapters });
    }

    return Response.json({ status: 'completed', transcript_id: id, chapters });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}