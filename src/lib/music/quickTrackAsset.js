/**
 * The single place a Quick Generate track becomes a library record.
 *
 * WHY: Quick Generate had TWO copies of this payload — the automatic save that
 * runs when a job finishes, and the manual "Save to Library" button. They drifted
 * (one carried clip_id and wav_url, the other carried the sound prompt and the
 * ID3 flag), so the same track was described differently depending on which path
 * stored it. A provenance record that changes shape by code path is not a record.
 */

import { calculateHumanParticipationScore } from '@/utils/participationScore';

/**
 * Build the UserAsset payload for a Quick Generate track.
 *
 * The Creative Ownership Score is computed here rather than passed in: Quick mode
 * is AI-driven by definition (auto lyrics, auto parameters), and the only human
 * signals are the creator's prompt, an optional genre pick and an optional voice
 * persona — so the scorer's inputs are the same whichever path saves.
 */
export async function buildQuickTrackAsset({
  user,
  prompt = '',
  provider,
  genreTag = '',
  personaSelected = false,
  fileUrl,
  coverImageUrl = '',
  params = {},
  metadata = {},
}) {
  const participation = await calculateHumanParticipationScore({
    userProvidedContent: false,
    prompt,
    styleOrTags: genreTag ? [genreTag] : [],
    personaOrTemplate: personaSelected,
    isIteration: false,
  });

  return {
    user_id: user.id,
    user_email: user.email,
    asset_type: 'track',
    title: params.title || prompt.slice(0, 40) || 'Generated Track',
    file_url: fileUrl,
    thumbnail_url: coverImageUrl || '',
    is_public: false,
    ai_label: participation.label,
    ai_disclosure_label: participation.label,
    ai_disclosure_basis: participation.basis,
    human_participation_score: participation.score,
    participation_signals: participation.signals,
    ddex_ai_metadata: participation.ddex,
    metadata: {
      genre: params.genre || '',
      mood: params.mood || '',
      bpm: params.bpm,
      key: params.key,
      duration: params.duration,
      provider,
      model: params.model || '',
      ai_assisted: true,
      prompt,
      sound_prompt: params.sound_prompt || '',
      lyrics: params.lyrics || '',
      tags: params.tags || '',
      vocal_gender: params.vocal_gender || '',
      vocal_timbre: params.vocal_timbre || '',
      content_hash: params.content_hash || '',
      ...metadata,
    },
  };
}