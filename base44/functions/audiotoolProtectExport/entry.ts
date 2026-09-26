// Audiotool Bridge — Protect & Register an exported mixdown or stem.
//
// Runs the scoring half of the provenance chain server-side so nothing about the
// score can be asserted by the browser:
//   1. AI-invocation telemetry is read from OUR database (NexusTelemetryEvent),
//      never from the request — it never leaves BASE Station servers.
//   2. COS is scored by the authoritative engine and FROZEN into the asset's
//      provenance_seal draft, so the manifest sealed later embeds exactly the
//      score computed from this session's log.
//   3. The UserAsset is created, which fires the BASE Mark V1 + V2 cascade.
//
// ORDER MATTERS: the C2PA manifest and the Base anchor are NOT produced here.
// Both must describe the delivered, watermarked audio — not this raw export —
// so the asset is created with chain_status 'awaiting_mark' (which the
// create-time anchor automation ignores) and sealProtectedExport seals + signs
// the manifest and anchors only after the V2 finalizer has completed.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { calculateHumanParticipationScore, COS_ENGINE_VERSION } from '../../shared/cosEngine.ts';
import { assertSafeUrl } from '../../shared/safeUrl.ts';
import { normalizeAudiusGenre } from '../../shared/audiusMetadata.ts';

// Audiotool TrackLicense enum → Audius license string. Unmapped values are
// omitted rather than guessed, so a release never claims a looser license.
const AUDIUS_LICENSE = { 4: 'All rights reserved', 2: 'Attribution CC BY', 3: 'Attribution-NonCommercial CC BY-NC' };

// The Audius remix contest this export is entered in, if any. Only ids are
// kept; the contest track is re-read on Audius when the remix is registered.
function contestEntry(c) {
  const id = String(c?.parent_track_id || '');
  if (!/^[A-Za-z0-9]{1,24}$/.test(id)) return undefined;
  const s = (v, max) => String(v || '').slice(0, max) || undefined;
  return {
    parent_track_id: id,
    event_id: s(c.event_id, 40),
    contest_title: s(c.contest_title, 160),
    parent_artist: s(c.parent_artist, 120),
  };
}

const hex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
const sha256 = async (data) => hex(await crypto.subtle.digest('SHA-256', data));
const n = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.floor(Number(v)) : 0);

// The Audiotool project snapshot becomes the track artwork (Audius requires
// cover art, and charts/radio/playlists display it). Rehosted so it outlives
// the Audiotool CDN link; every redirect hop is re-validated against SSRF.
async function rehostSnapshot(base44, raw) {
  if (!raw) return '';
  try {
    let url = assertSafeUrl(raw);
    let r = await fetch(url, { redirect: 'manual' });
    for (let hops = 0; r.status >= 300 && r.status < 400 && hops < 3; hops++) {
      url = assertSafeUrl(new URL(r.headers.get('location') || '', url).toString());
      r = await fetch(url, { redirect: 'manual' });
    }
    const type = r.headers.get('content-type') || '';
    if (!r.ok || !type.startsWith('image/')) return '';
    const buf = await r.arrayBuffer();
    if (buf.byteLength > 8_000_000) return '';
    const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
    const { file_url } = await base44.integrations.Core.UploadPublicFile({
      file: new File([buf], `audiotool-snapshot.${ext}`, { type }),
    });
    return file_url || '';
  } catch {
    return '';
  }
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url, title, project_url, contribution = {}, session = {} } = await req.json();
    if (!file_url || !title?.trim() || !project_url) {
      return Response.json({ error: 'file_url, title and project_url are required' }, { status: 400 });
    }

    const c = {
      humanNotes: n(contribution.humanNotes), aiNotes: n(contribution.aiNotes),
      humanDevices: n(contribution.humanDevices), aiDevices: n(contribution.aiDevices),
      humanAutomation: n(contribution.humanAutomation), aiAutomation: n(contribution.aiAutomation),
      humanPatterns: n(contribution.humanPatterns), aiPatterns: n(contribution.aiPatterns),
      // Context only — never counted toward the share.
      mixerChannels: n(contribution.mixerChannels),
    };
    const human = c.humanNotes + c.humanDevices + c.humanAutomation + c.humanPatterns;
    const total = human + c.aiNotes + c.aiDevices + c.aiAutomation + c.aiPatterns;
    c.humanShare = total ? Math.round((human / total) * 100) : null;

    // 1. Server-held telemetry, scoped to this creator.
    const log = await base44.entities.NexusTelemetryEvent.filter(
      { user_id: user.id, project_url }, 'created_date', 500,
    );

    // 2. Authoritative COS.
    const longestPrompt = log.reduce((a, e) => ((e.prompt || '').length > a.length ? e.prompt : a), '');
    const cos = calculateHumanParticipationScore({
      prompt: longestPrompt,
      userProvidedContent: c.humanNotes > c.aiNotes,
      // Hand-programmed step patterns are performance input just like played notes;
      // hand-drawn automation is mix/sound-design work alongside device choices.
      humanInstrumentPerformance: c.humanNotes > 0 || c.humanPatterns > 0,
      humanDspDesign: c.humanDevices > 0 || c.humanAutomation > 0,
      isIteration: log.length > 1,
      styleOrTags: [],
      referenceFile: false,
      personaOrTemplate: false,
      hasSyntheticVocals: false,
      isAutomatedMaster: false,
    });
    // No AI observed through the bridge is not proof of a human-only recording.
    const label = log.length ? cos.label : 'unverified';
    const remixOf = contestEntry(session.contest);
    const basis = (log.length
      ? `${cos.basis} Audiotool session: ${c.humanShare ?? 0}% of notes, devices, step patterns and automation points human-made, ${log.length} AI invocation(s) logged.`
      : 'No AI invocations were recorded through the Audiotool Bridge for this project.')
      + (remixOf ? ` Remix entry: includes contest stems by ${remixOf.parent_artist || 'the contest host'} (third-party material, not scored as the creator's own).` : '');

    // Raw export hash — recorded as the manifest's parent ingredient, never anchored.
    const dl = await fetch(assertSafeUrl(file_url));
    if (!dl.ok) throw new Error(`Could not read the exported audio (${dl.status})`);
    const rawHash = await sha256(await dl.arrayBuffer());
    const createdAt = new Date().toISOString();

    const provenanceSeal = {
      status: 'awaiting_mark',
      title: title.trim(),
      raw_export_sha256: rawHash,
      created_at: createdAt,
      telemetry_event_ids: log.map((e) => e.id),
      actions: [
        { action: 'c2pa.created', when: createdAt, softwareAgent: 'Audiotool', digitalSourceType: log.length ? 'http://cv.iptc.org/newscodes/digitalsourcetype/compositeWithTrainedAlgorithmicMedia' : 'http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture' },
        ...log.map((e) => ({ action: 'c2pa.edited', when: e.at || e.created_date, softwareAgent: `BASE Station ${e.tool}`, digitalSourceType: 'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia' })),
      ],
      cos: {
        engine: COS_ENGINE_VERSION, score: cos.score, label, confidence: cos.confidence,
        dimensions: cos.dimensions, ddex: cos.ddex, contribution: c, ai_invocations: log.length,
      },
    };

    // Session metadata (display only — never part of the score).
    const bpm = Number(session.bpm);
    const sessionBpm = Number.isFinite(bpm) && bpm >= 20 && bpm <= 400 ? Math.round(bpm * 100) / 100 : undefined;
    const coverUrl = await rehostSnapshot(base44, session.cover_url);
    const projectTags = (Array.isArray(session.tags) ? session.tags : []).map((t) => String(t).slice(0, 40)).slice(0, 10);
    // The creator's pick wins; otherwise it's derived from the project tags.
    const genre = normalizeAudiusGenre(String(session.genre || '').slice(0, 40), '')
      || normalizeAudiusGenre(projectTags.join(', '), '') || undefined;
    const license = AUDIUS_LICENSE[Number(session.license)];

    // 3. Creating the asset starts BASE Mark; sealing + anchoring follow it.
    const asset = await base44.entities.UserAsset.create({
      ...(coverUrl ? { thumbnail_url: coverUrl } : {}),
      user_id: user.id,
      user_email: user.email,
      asset_type: 'track',
      title: title.trim(),
      file_url,
      origin: 'creator',
      ai_label: label,
      ai_disclosure_label: label,
      ai_disclosure_basis: basis,
      human_participation_score: cos.score,
      participation_signals: cos.signals,
      ddex_ai_metadata: cos.ddex,
      chain_status: 'awaiting_mark',
      tags: ['audiotool', ...(remixOf ? ['remix', 'remix-contest'] : [])],
      metadata: {
        source: 'audiotool_bridge',
        genre,
        license,
        downloadable: !!session.download_allowed,
        audiotool_tags: projectTags,
        audius_remix_of: remixOf,
        audiotool_project: project_url,
        audiotool_project_title: String(session.project_title || '').slice(0, 120) || undefined,
        bpm: sessionBpm,
        cos_engine: cos.engine,
        cos_confidence: cos.confidence,
        raw_export_sha256: rawHash,
        nexus_telemetry: { contribution: c, invocations: log.length },
        provenance_seal: provenanceSeal,
      },
    });

    return Response.json({ asset, anchoring: !!user.auto_anchor_provenance });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}