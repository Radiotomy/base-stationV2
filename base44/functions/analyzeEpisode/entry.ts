import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { submitTranscript, pollTranscript } from '../../shared/assemblyai.ts';

/**
 * ORVO Studio — optional Episode Intelligence.
 * Runs AssemblyAI transcript analysis (speakers, sentiment, topics, highlights)
 * on a finished episode. Opt-in per episode; a paid upgrade later.
 *
 * Payload: { episode_id: string, transcript_id?: string }
 * Returns: { status, transcript_id, analysis? }
 */
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = secrets.get('ASSEMBLYAI_API_KEY');
    if (!apiKey) return Response.json({ error: 'ASSEMBLYAI_API_KEY not configured' }, { status: 500 });

    const { episode_id, transcript_id } = await req.json();
    if (!episode_id) return Response.json({ error: 'episode_id is required' }, { status: 400 });

    const eps = await base44.entities.Episode.filter({ id: episode_id });
    const episode = eps?.[0];
    if (!episode) return Response.json({ error: 'Episode not found' }, { status: 404 });
    if (episode.user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Not your episode' }, { status: 403 });
    }
    if (!episode.audio_url) return Response.json({ error: 'Episode has no audio' }, { status: 400 });

    const id = transcript_id || await submitTranscript(apiKey, episode.audio_url, {
      speaker_labels: true,
      sentiment_analysis: true,
      iab_categories: true,
      auto_highlights: true,
    });

    const data = await pollTranscript(apiKey, id);

    if (data.status === 'error') {
      return Response.json({ error: data.error || 'Analysis failed' }, { status: 502 });
    }
    if (data.status !== 'completed') {
      return Response.json({ status: data.status, transcript_id: id });
    }

    // Persist the transcript text so the episode keeps it after analysis
    if (data.text && !episode.transcript) {
      await base44.entities.Episode.update(episode.id, { transcript: data.text });
    }

    const speakers = {};
    for (const u of data.utterances || []) {
      const key = u.speaker || '?';
      speakers[key] = (speakers[key] || 0) + Math.max(0, (u.end - u.start) / 1000);
    }

    const sentiment = { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 };
    for (const s of data.sentiment_analysis_results || []) {
      if (sentiment[s.sentiment] !== undefined) sentiment[s.sentiment] += 1;
    }

    return Response.json({
      status: 'completed',
      transcript_id: id,
      analysis: {
        speakers: Object.entries(speakers).map(([speaker, seconds]) => ({ speaker, seconds: Math.round(seconds) })),
        sentiment,
        topics: (data.iab_categories_result?.summary
          ? Object.entries(data.iab_categories_result.summary)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8)
              .map(([label, relevance]) => ({ label, relevance }))
          : []),
        highlights: (data.auto_highlights_result?.results || [])
          .slice(0, 10)
          .map((h) => ({ text: h.text, count: h.count })),
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}