import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { calculateHumanParticipationScore } from '../../shared/cosEngine.ts';
import { persistUrl } from '../../shared/persistMedia.ts';
import { scanForeignProvenanceFromUrl } from '../../shared/foreignProvenance.ts';

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
    const action = body.action || 'mark';
    const episodeId = String(body.episode_id || '');
    if (!episodeId) return Response.json({ error: 'Missing episode_id' }, { status: 400 });

    const episode = await base44.asServiceRole.entities.Episode.get(episodeId).catch(() => null);
    if (!episode) return Response.json({ error: 'Episode not found' }, { status: 404 });
    if (episode.user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!episode.audio_url) return Response.json({ error: 'Episode has no audio yet' }, { status: 400 });

    // ── anchor ── pin the provenance bundle to IPFS and write the anchor on
    // Base mainnet, reusing the platform-paid registerOnBase flow so episodes
    // and music share one registry. Solana is the planned second network.
    if (action === 'anchor') {
      if (episode.chain_status === 'registered') {
        return Response.json({ ok: true, already: true, transaction_hash: episode.chain_tx_hash });
      }
      const res = await base44.functions.invoke('registerOnBase', {
        action: 'register',
        track: {
          title: episode.title,
          track_url: episode.audio_url,
          cover_image_url: episode.thumbnail_url || '',
          genre: 'podcast',
          asset_id: episode.base_mark_asset_id || null,
          ai_label: episode.ai_disclosure_label || undefined,
          description: episode.description || '',
          ai_tools_used: 'ORVO Studio',
        },
      });
      const out = res.data || {};
      const updated = await base44.asServiceRole.entities.Episode.update(episodeId, {
        chain_registry_id: out.registry_id || episode.chain_registry_id,
        chain_tx_hash: out.transaction_hash || '',
        chain_metadata_uri: out.metadata_uri || '',
        chain_network: 'base-mainnet',
        chain_status: out.registration_status === 'registered' ? 'registered' : 'pending',
      });
      return Response.json({ ok: true, chain: out, episode: updated });
    }

    // ── reanchor ── publish a CORRECTION anchor for an episode whose existing
    // anchor carries a wrong disclosure label. A blockchain record cannot be
    // rewritten or deleted, so the remedy is a new anchor that explicitly names
    // and supersedes the bad transaction. The freshly pinned IPFS bundle reads
    // the label off the linked UserAsset, so that asset is corrected first —
    // otherwise the new bundle would just repeat the old claim.
    if (action === 'reanchor') {
      if (episode.chain_status !== 'registered' || !episode.chain_tx_hash) {
        return Response.json({ error: 'Episode has no registered anchor to correct' }, { status: 400 });
      }

      if (episode.base_mark_asset_id) {
        await base44.asServiceRole.entities.UserAsset.update(episode.base_mark_asset_id, {
          ai_label: episode.ai_disclosure_label,
          ai_disclosure_label: episode.ai_disclosure_label,
          ai_disclosure_basis: episode.ai_disclosure_basis || '',
          human_participation_score: episode.human_participation_score,
          participation_signals: episode.participation_signals || {},
        }).catch(() => {});
      }

      const reason = String(body.reason || 'Corrects an incorrect AI disclosure label on the superseded anchor.');
      const res = await base44.functions.invoke('registerOnBase', {
        action: 'register',
        supersedes_tx_hash: episode.chain_tx_hash,
        correction_reason: reason,
        track: {
          title: episode.title,
          track_url: episode.storage_audio_url || episode.audio_url,
          cover_image_url: episode.thumbnail_url || '',
          genre: 'podcast',
          asset_id: episode.base_mark_asset_id || null,
          ai_label: episode.ai_disclosure_label || undefined,
          description: episode.description || '',
          ai_tools_used: 'ORVO Studio',
        },
      });
      const out = res.data || {};
      if (out.registration_status !== 'registered') {
        return Response.json({ ok: false, chain: out }, { status: 502 });
      }

      const updated = await base44.asServiceRole.entities.Episode.update(episodeId, {
        chain_registry_id: out.registry_id,
        chain_tx_hash: out.transaction_hash,
        chain_metadata_uri: out.metadata_uri || '',
        chain_network: 'base-mainnet',
        chain_status: 'registered',
      });
      return Response.json({
        ok: true,
        superseded_tx_hash: episode.chain_tx_hash,
        chain: out,
        episode: updated,
      });
    }

    // 'retry' re-mints the asset after a failed mark (e.g. a gateway timeout on
    // the first attempt) — a fresh UserAsset create re-triggers the cascade.
    if (episode.base_mark_asset_id && action !== 'retry') {
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
    const aiVoiceUsed = (voiceovers || []).length > 0
      || (recordings || []).some((r) => r.source === 'ai_voiceover');

    // Origin is DECLARED, not detected. The platform has no AI-speech
    // classifier, and COS only observes in-app creative-process telemetry —
    // so an episode recorded outside the app and uploaded as a finished file
    // legitimately produces no recording rows. Treating that silence as proof
    // of AI authorship is what mislabelled human shows as 'ai_generated'.
    // The creator's own attestation is therefore the authoritative signal,
    // matching how RIAA/IFPI disclosure actually works (rights-holder declared).
    const declared = episode.declared_origin || '';
    const humanAuthored = declared === 'human' || humanRecordings.length > 0;

    const cos = calculateHumanParticipationScore({
      // For spoken word the authorship IS the script + the recorded voice
      // performance — there is no prompt-driven generation step to score.
      userProvidedContent: humanAuthored,
      prompt: episode.description || '',
      styleOrTags: episode.chapters?.length ? ['chaptered'] : [],
      humanInstrumentPerformance: humanAuthored,
      hasSyntheticVocals: aiVoiceUsed,
      isIteration: (recordings || []).length > 1,
      isAutomatedMaster: false,
    });

    // Label resolution — never infer AI authorship from missing telemetry.
    let label;
    let basis;
    if (declared) {
      label = declared;
      basis = `Origin declared by the rights holder as "${declared}". ${cos.basis}`;
    } else if (humanRecordings.length > 0 && !aiVoiceUsed) {
      label = 'human';
      basis = cos.basis;
    } else if (aiVoiceUsed) {
      label = cos.score >= 40 ? 'ai_assisted' : 'ai_generated';
      basis = `Synthetic voice assets detected in this show. ${cos.basis}`;
    } else {
      // No AI use observed AND no attestation on file — say exactly that
      // rather than publishing an unfounded AI claim.
      label = 'unverified';
      basis = 'Origin not declared and no AI generation was observed in-app. This is not a finding of AI authorship — the creator has not yet attested how this episode was made.';
    }

    // The marking source must be reliable: Replicate's input downloader has a
    // 10s read timeout and public IPFS gateways (gateway.pinata.cloud) are
    // rate-limited — marking straight from a gateway URL fails the neural
    // embed. Prefer the Base44 storage copy captured at upload; otherwise
    // rehost the gateway audio into storage before minting. The Pinata pin
    // remains the canonical IPFS copy.
    let markSourceUrl = episode.storage_audio_url || '';
    if (!markSourceUrl) {
      const { url: persistedUrl } = await persistUrl(
        base44,
        episode.audio_url,
        `${(episode.title || 'episode').slice(0, 60)}.audio`,
      );
      markSourceUrl = persistedUrl || episode.audio_url;
      if (persistedUrl) {
        await base44.asServiceRole.entities.Episode.update(episodeId, { storage_audio_url: persistedUrl });
      }
    }

    // Tier 1 foreign-provenance read — done BEFORE our own cascade is applied,
    // while the container still carries only what the source tool wrote. For an
    // outside upload this is often the only true statement available about the
    // machine and software behind it. Never fatal: a file with no such metadata
    // is a legitimate outcome, not an error.
    const foreign = await scanForeignProvenanceFromUrl(markSourceUrl).catch(() => null);
    if (foreign) {
      await base44.asServiceRole.entities.Episode.update(episodeId, { external_provenance: foreign }).catch(() => {});
      if (label === 'unverified' && foreign.signal_count > 0) {
        basis += ` Source file declares: ${Object.values(foreign.observations).join(' · ')}.`;
      }
    }

    // Minting the asset triggers the existing BASE Mark cascade automation.
    const asset = await base44.entities.UserAsset.create({
      user_id: user.id,
      user_email: user.email,
      asset_type: 'master',
      title: `${episode.title} — ORVO episode`,
      description: `Podcast episode audio registered from ORVO Studio.`,
      file_url: markSourceUrl,
      thumbnail_url: episode.thumbnail_url,
      origin: 'creator',
      ai_label: label,
      ai_disclosure_label: label,
      ai_disclosure_basis: basis,
      human_participation_score: cos.score,
      participation_signals: cos.signals,
      ddex_ai_metadata: cos.ddex,
      metadata: {
        source: 'orvo_episode',
        episode_id: episodeId,
        podcast_id: episode.podcast_id,
        ipfs_hash: episode.ipfs_hash,
        ipfs_gateway_url: episode.audio_url,
        duration_seconds: episode.duration_seconds,
        external_provenance: foreign || undefined,
      },
    });

    const updated = await base44.asServiceRole.entities.Episode.update(episodeId, {
      base_mark_asset_id: asset.id,
      provenance_status: 'processing',
      human_participation_score: cos.score,
      ai_disclosure_label: label,
      ai_disclosure_basis: basis,
      participation_signals: cos.signals,
    });

    return Response.json({ ok: true, asset_id: asset.id, cos, episode: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}