// Attestation reconciliation — the "relationship we already own" signal.
//
// This deliberately answers a CLOSED-WORLD question instead of the open-world
// one AudioSeal-style detectors get wrong: rather than "was this audio made by
// some AI somewhere", it asks "does this creator's attestation agree with the
// creative-process records BASE Station itself holds?" Those records are finite
// and self-owned — the synthetic voices this account minted, the voiceover
// assets attached to the show, the human recording takes, and the creator's own
// prior attested episodes.
//
// It produces findings, never a label. A discrepancy means "a human should
// look", not "this creator lied" — because every input here has innocent
// explanations (a show can own AI stingers and still be a human-hosted show).

const CORROBORATES = 'corroborates';
const CONFLICTS = 'conflicts';
const CONTEXT = 'context';

/**
 * @param episode           the Episode record (declared_origin is the claim)
 * @param recordings        Recording rows for this episode
 * @param showVoiceovers    OrvoPodcastAsset voiceover rows for the parent show
 * @param personas          VoicePersona rows owned by this creator
 * @param priorEpisodes     the creator's other episodes (attestation history)
 */
export function reconcileAttestation({ episode, recordings = [], showVoiceovers = [], personas = [], priorEpisodes = [] }) {
  const declared = episode?.declared_origin || '';
  const humanTakes = recordings.filter((r) => r?.source !== 'ai_voiceover');
  const aiTakes = recordings.filter((r) => r?.source === 'ai_voiceover');
  const syntheticAssets = showVoiceovers.length;

  const findings = [];

  // ── Registered synthetic voices: closed-world, high precision ──
  // A persona is a voice THIS account minted. Its existence is not evidence
  // about this episode; it only becomes relevant once synthetic audio is
  // actually attached to the show.
  if (personas.length) {
    findings.push({
      kind: CONTEXT,
      code: 'synthetic_voice_registry',
      detail: `${personas.length} synthetic voice ${personas.length === 1 ? 'profile' : 'profiles'} registered to this creator (${[...new Set(personas.map((p) => p.provider).filter(Boolean))].join(', ') || 'unknown provider'}).`,
    });
  }

  if (aiTakes.length || syntheticAssets) {
    const where = [];
    if (aiTakes.length) where.push(`${aiTakes.length} AI voiceover take${aiTakes.length === 1 ? '' : 's'} on this episode`);
    if (syntheticAssets) where.push(`${syntheticAssets} generated voiceover asset${syntheticAssets === 1 ? '' : 's'} on this show`);
    findings.push({
      kind: declared === 'human' ? CONFLICTS : CONTEXT,
      code: 'synthetic_audio_present',
      detail: `${where.join(' and ')}.${declared === 'human' ? ' The episode is declared fully human — a show can legitimately own AI stingers, so this is flagged for review rather than treated as a contradiction.' : ''}`,
    });
  }

  // ── Human recording takes: the strongest corroboration we can offer ──
  if (humanTakes.length) {
    findings.push({
      kind: declared === 'ai_generated' ? CONFLICTS : CORROBORATES,
      code: 'human_takes_present',
      detail: `${humanTakes.length} human recording take${humanTakes.length === 1 ? '' : 's'} captured in-app for this episode.${declared === 'ai_generated' ? ' The episode is declared fully AI-generated, which those takes do not match.' : ''}`,
    });
  }

  // ── Creator continuity: the prior is the creator's own history ──
  const priorHuman = priorEpisodes.filter((e) => e?.declared_origin === 'human').length;
  const priorAny = priorEpisodes.filter((e) => e?.declared_origin).length;
  if (priorAny) {
    findings.push({
      kind: declared && priorHuman === priorAny && declared === 'human' ? CORROBORATES : CONTEXT,
      code: 'attestation_history',
      detail: `This creator has attested origin on ${priorAny} other episode${priorAny === 1 ? '' : 's'} (${priorHuman} declared human).`,
    });
  }

  if (!declared) {
    findings.push({
      kind: CONTEXT,
      code: 'no_attestation',
      detail: 'No origin attestation on file. Nothing here infers AI authorship — the creator simply has not declared how this episode was made.',
    });
  }

  const conflicts = findings.filter((f) => f.kind === CONFLICTS);
  const corroborations = findings.filter((f) => f.kind === CORROBORATES);

  const status = conflicts.length
    ? 'review_suggested'
    : corroborations.length
    ? 'corroborated'
    : 'insufficient_evidence';

  return {
    status,
    declared_origin: declared || null,
    findings,
    conflict_count: conflicts.length,
    corroboration_count: corroborations.length,
    summary: conflicts.length
      ? `${conflicts.length} record${conflicts.length === 1 ? '' : 's'} we hold do not line up with the declared origin — worth a look.`
      : corroborations.length
      ? 'Creative-process records we hold support the declared origin.'
      : 'No in-app creative-process records available to corroborate or question the declared origin.',
    advisory: true,
    reviewed_at: new Date().toISOString(),
  };
}