import { createClientFromRequest } from 'npm:@base44/sdk@0.8.43';
import { assertSafeUrl } from '../../shared/safeUrl.ts';

// Third-party AI-speech detection, recorded as a PROVIDER CLAIM.
//
// This does not run a classifier of our own — deliberately. It asks a provider
// about its OWN generated speech (ElevenLabs' AI-speech classifier detects
// ElevenLabs output), which is a closed-world question the provider can answer
// with authority, instead of an open-world guess that historically mislabelled
// real human podcast narration as AI.
//
// Result is written ONLY to Episode.advisory_review.third_party. It never
// changes ai_disclosure_label, the Creative Ownership Score, the BASE Mark
// cascade, or the on-chain anchor. A "not detected" answer means only that this
// one provider does not recognise the audio as its own.
export default async function (req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const apiKey = Deno.env.get('ELEVENLABS_API');
  if (!apiKey) return Response.json({ error: 'ElevenLabs API key is not configured' }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const episodeId = String(body.episode_id || '');
  if (!episodeId) return Response.json({ error: 'Missing episode_id' }, { status: 400 });

  const episode = await base44.asServiceRole.entities.Episode.get(episodeId).catch(() => null);
  if (!episode) return Response.json({ error: 'Episode not found' }, { status: 404 });
  if (episode.user_id !== user.id && user.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const sourceUrl = episode.storage_audio_url || episode.audio_url;
  if (!sourceUrl) return Response.json({ error: 'Episode has no audio to scan' }, { status: 400 });

  const audioRes = await fetch(assertSafeUrl(sourceUrl));
  if (!audioRes.ok) {
    return Response.json({ error: `Could not read episode audio (${audioRes.status})` }, { status: 502 });
  }
  const full = await audioRes.blob();

  // The provider caps uploads at 10 MB, and podcast episodes routinely exceed
  // that. Send a leading slice rather than failing — and record that only part
  // of the episode was examined, so the result is never read as a whole-episode
  // verdict.
  const LIMIT = 9.5 * 1024 * 1024;
  const truncated = full.size > LIMIT;
  const audio = truncated ? full.slice(0, LIMIT) : full;

  const form = new FormData();
  form.append('file', audio, 'episode.audio');

  const res = await fetch('https://api.elevenlabs.io/v1/moderation/ai-speech-classification', {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: form,
  });
  const raw = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = raw?.detail?.message || raw?.detail || `HTTP ${res.status}`;
    return Response.json({ error: `Provider could not classify this audio: ${detail}` }, { status: 502 });
  }

  // The response shape is the provider's, and it evolves — keep the raw claim
  // verbatim and derive a display probability best-effort rather than asserting
  // a number the provider did not give us.
  const probability = typeof raw?.ai_speech_probability === 'number'
    ? raw.ai_speech_probability
    : typeof raw?.probability === 'number'
    ? raw.probability
    : null;

  const third_party = {
    provider: 'elevenlabs',
    check: 'ai_speech_classification',
    probability,
    raw_claim: raw,
    summary: probability === null
      ? 'The provider returned a classification result without a probability score — the raw claim is retained below.'
      : probability >= 0.5
      ? `${Math.round(probability * 100)}% likelihood this audio is this provider's own generated speech.`
      : `${Math.round((1 - probability) * 100)}% likelihood this audio is NOT this provider's generated speech.`,
    analyzed_portion: truncated
      ? `First ${(LIMIT / 1024 / 1024).toFixed(1)} MB of ${(full.size / 1024 / 1024).toFixed(1)} MB (provider upload cap) — a partial read, not a whole-episode verdict.`
      : 'Whole episode.',
    caveat: 'Reported by an external provider about its own generated speech. A negative result only means this provider does not recognise the audio — it is not proof the audio is human, and it never changes the declared origin.',
    advisory: true,
    checked_at: new Date().toISOString(),
  };

  const updated = await base44.asServiceRole.entities.Episode.update(episodeId, {
    advisory_review: { ...(episode.advisory_review || {}), third_party },
  });

  return Response.json({ ok: true, third_party, episode: updated });
}