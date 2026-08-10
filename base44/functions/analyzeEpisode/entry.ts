import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { submitTranscript, pollTranscript, getTranscript } from '../../shared/assemblyai.ts';

/**
 * ORVO Studio — episode intelligence via AssemblyAI.
 *
 * This is the STT side of the studio (AssemblyAI has no voice catalog — Inworld
 * and ElevenLabs cover synthesis). It adds what synthesis cannot: who spoke when,
 * the quotable moments, the emotional arc, and the topics of a finished episode.
 *
 * Payload:
 *   { audio_url, episode_id? }      → submit + poll (~50s budget)
 *   { transcript_id, episode_id? }  → continue polling an in-flight job
 *
 * Returns { status, transcript_id, speakers[], utterances[], highlights[], sentiment{}, topics[] }.
 */
export default async function (req: Request): Promise<Response> {
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
      id = await submitTranscript(apiKey, audio_url, {
        speaker_labels: true,
        auto_highlights: true,
        sentiment_analysis: true,
        iab_categories: true,
      });
    }

    const data = transcript_id ? await getTranscript(apiKey, id) : await pollTranscript(apiKey, id);

    if (data.status === 'error') {
      return Response.json({ status: 'error', transcript_id: id, error: data.error }, { status: 502 });
    }
    if (data.status !== 'completed') {
      return Response.json({ status: 'processing', transcript_id: id });
    }

    const utterances = (data.utterances || []).map((u) => ({
      speaker: u.speaker,
      start_seconds: Math.round((u.start || 0) / 1000),
      text: u.text,
    }));
    const speakers = Array.from(new Set(utterances.map((u) => u.speaker)));

    const highlights = (data.auto_highlights_result?.results || [])
      .slice(0, 12)
      .map((h) => ({ text: h.text, count: h.count, rank: h.rank }));

    const sentimentRows = data.sentiment_analysis_results || [];
    const sentiment = sentimentRows.reduce(
      (acc, r) => {
        const k = (r.sentiment || '').toLowerCase();
        if (k in acc) acc[k] += 1;
        return acc;
      },
      { positive: 0, neutral: 0, negative: 0 }
    );

    const topics = Object.entries(data.iab_categories_result?.summary || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, relevance]) => ({ label: label.split('>').pop(), relevance }));

    if (episode_id) {
      await base44.entities.Episode.update(episode_id, { transcript: data.text || '' });
    }

    return Response.json({
      status: 'completed',
      transcript_id: id,
      speakers,
      utterances: utterances.slice(0, 200),
      highlights,
      sentiment,
      topics,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}