import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { calculateHumanParticipationScore } from '../../shared/cosEngine.ts';

// ORVO — BASE Mark + COS for a podcast episode.
//
// The episode itself is not the forensic record: we mint a UserAsset from the
// episode audio, which is exactly what the existing "Auto BASE Mark V2 on new
// audio assets" automation watches. That gives episodes the SAME V1+V2 cascade
// as music tracks with no parallel marking pipeline. The episode then links to
// that asset and carries the COS result for display.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const episodeId = String(body.episode_id || '');
    if (!episodeId) return Response.json({ error: 'Missing episode_id' }, { status: 400 });

    const episode = await base44.asServiceRole.entities.Episode.get(episodeId).catch(() => null);
    if (!episode) return Response.json({ error: 'Episode not found' }, { status: 404 });
    if (episode.user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!episode.audio_url) return Response.json({ error: 'Episode has no audio yet' }, { status: 400 });
    if (episode.base_mark_asset_id) {
      return Response.json({ ok: true, already: true, asset_id: episode.base_mark_asset_id });
    }

    // ── COS telemetry for spoken-word content ──
    // A podcast episode's human authorship lives in the recording and the show
    // notes, not in generation prompts. Guest takes and human recordings count
    // as performance; AI voiceover assets flag synthetic vocals.
    const [recordings, voiceovers] = await Promise.all([
      base44.asServiceRole.entities.Recording.filter({ episode_id: episodeId }),
      base44.asServiceRole.entities.OrvoPodcastAsset.filter({ podcast_id: episode.podcast_id, asset_type: 'voiceover' }),
    ]);
    const humanRecordings = (recordings || []).filter((r) => r.source !== 'ai_voiceover');
    const cos = calculateHumanParticipationScore({
      userProvidedContent: humanRecordings.length > 0,
      prompt: episode.description || '',
      styleOrTags: episode.chapters?.length ? ['chaptered'] : [],
      humanInstrumentPerformance: humanRecordings.length > 0,
      hasSyntheticVocals: (voiceovers || []).length > 0,
      isIteration: (recordings || []).length > 1,
      isAutomatedMaster: false,
    });

    // Fully human-recorded episodes with no synthetic voice are labelled human.
    const label = humanRecordings.length > 0 && (voiceovers || []).length === 0 ? 'human' : cos.label;

    // Minting the asset triggers the existing BASE Mark cascade automation.
    const asset = await base44.entities.UserAsset.create({
      user_id: user.id,
      user_email: user.email,
      asset_type: 'master',
      title: `${episode.title} — ORVO episode`,
      description: `Podcast episode audio registered from ORVO Studio.`,
      file_url: episode.audio_url,
      thumbnail_url: episode.thumbnail_url,
      origin: 'creator',
      ai_label: label,
      ai_disclosure_label: label === 'human' ? 'ai_assisted' : cos.label,
      ai_disclosure_basis: cos.basis,
      human_participation_score: cos.score,
      participation_signals: cos.signals,
      ddex_ai_metadata: cos.ddex,
      metadata: {
        source: 'orvo_episode',
        episode_id: episodeId,
        podcast_id: episode.podcast_id,
        ipfs_hash: episode.ipfs_hash,
        duration_seconds: episode.duration_seconds,
      },
    });

    const updated = await base44.asServiceRole.entities.Episode.update(episodeId, {
      base_mark_asset_id: asset.id,
      provenance_status: 'processing',
      human_participation_score: cos.score,
      ai_disclosure_label: label,
      ai_disclosure_basis: cos.basis,
      participation_signals: cos.signals,
    });

    return Response.json({ ok: true, asset_id: asset.id, cos, episode: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}