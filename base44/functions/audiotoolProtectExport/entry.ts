// Audiotool Bridge — Protect & Register an exported mixdown or stem.
//
// Runs the whole provenance chain server-side so nothing about the score can be
// asserted by the browser:
//   1. AI-invocation telemetry is read from OUR database (NexusTelemetryEvent),
//      never from the request — it never leaves BASE Station servers.
//   2. COS is scored by the authoritative engine.
//   3. A C2PA-format manifest is built from the COS result and bound to the
//      exact audio bytes; its SHA-256 becomes c2pa_provenance_hash.
//   4. The UserAsset is created, which fires the existing cascade: BASE Mark
//      V1 spread-spectrum + V2 neural embedding, then (for opted-in creators)
//      the Base mainnet anchor, whose calldata carries `c2pa:<hash>`.
//
// The manifest is an UNSIGNED claim (no C2PA signing certificate is held), so it
// is stored privately and stated as such — never presented as validated.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { calculateHumanParticipationScore, COS_ENGINE_VERSION } from '../../shared/cosEngine.ts';
import { assertSafeUrl } from '../../shared/safeUrl.ts';

const hex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
const sha256 = async (data) => hex(await crypto.subtle.digest('SHA-256', data));
const n = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.floor(Number(v)) : 0);

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url, title, project_url, contribution = {} } = await req.json();
    if (!file_url || !title?.trim() || !project_url) {
      return Response.json({ error: 'file_url, title and project_url are required' }, { status: 400 });
    }

    const c = {
      humanNotes: n(contribution.humanNotes), aiNotes: n(contribution.aiNotes),
      humanDevices: n(contribution.humanDevices), aiDevices: n(contribution.aiDevices),
    };
    const total = c.humanNotes + c.aiNotes + c.humanDevices + c.aiDevices;
    c.humanShare = total ? Math.round(((c.humanNotes + c.humanDevices) / total) * 100) : null;

    // 1. Server-held telemetry, scoped to this creator.
    const log = await base44.entities.NexusTelemetryEvent.filter(
      { user_id: user.id, project_url }, 'created_date', 500,
    );

    // 2. Authoritative COS.
    const longestPrompt = log.reduce((a, e) => ((e.prompt || '').length > a.length ? e.prompt : a), '');
    const cos = calculateHumanParticipationScore({
      prompt: longestPrompt,
      userProvidedContent: c.humanNotes > c.aiNotes,
      humanInstrumentPerformance: c.humanNotes > 0,
      humanDspDesign: c.humanDevices > 0,
      isIteration: log.length > 1,
      styleOrTags: [],
      referenceFile: false,
      personaOrTemplate: false,
      hasSyntheticVocals: false,
      isAutomatedMaster: false,
    });
    // No AI observed through the bridge is not proof of a human-only recording.
    const label = log.length ? cos.label : 'unverified';
    const basis = log.length
      ? `${cos.basis} Audiotool session: ${c.humanShare ?? 0}% of notes/devices human-made, ${log.length} AI invocation(s) logged.`
      : 'No AI invocations were recorded through the Audiotool Bridge for this project.';

    // 3. C2PA-format manifest bound to the audio bytes.
    const dl = await fetch(assertSafeUrl(file_url));
    if (!dl.ok) throw new Error(`Could not read the exported audio (${dl.status})`);
    const audioHash = await sha256(await dl.arrayBuffer());
    const createdAt = new Date().toISOString();
    const manifest = {
      claim_generator: 'BASE Station Audiotool Bridge',
      format: 'c2pa-json/unsigned',
      title: title.trim(),
      instance_id: `urn:sha256:${audioHash}`,
      signature: null,
      assertions: [
        { label: 'c2pa.hash.data', data: { alg: 'sha256', hash: audioHash } },
        {
          label: 'c2pa.actions',
          data: {
            actions: [
              { action: 'c2pa.created', when: createdAt, softwareAgent: 'Audiotool', digitalSourceType: log.length ? 'http://cv.iptc.org/newscodes/digitalsourcetype/compositeWithTrainedAlgorithmicMedia' : 'http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture' },
              ...log.map((e) => ({ action: 'c2pa.edited', when: e.at || e.created_date, softwareAgent: `BASE Station ${e.tool}`, digitalSourceType: 'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia' })),
            ],
          },
        },
        {
          label: 'basestation.cos',
          data: { engine: COS_ENGINE_VERSION, score: cos.score, label, confidence: cos.confidence, dimensions: cos.dimensions, ddex: cos.ddex, contribution: c, ai_invocations: log.length },
        },
      ],
    };
    const manifestJson = JSON.stringify(manifest);
    const c2paHash = await sha256(new TextEncoder().encode(manifestJson));
    const { file_uri: manifestUri } = await base44.integrations.Core.UploadPrivateFile({
      file: new File([manifestJson], `c2pa-${c2paHash.slice(0, 12)}.json`, { type: 'application/json' }),
    });

    // 4. Creating the asset starts BASE Mark + (opt-in) Base anchoring.
    const asset = await base44.entities.UserAsset.create({
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
      c2pa_provenance_hash: c2paHash,
      tags: ['audiotool'],
      metadata: {
        source: 'audiotool_bridge',
        audiotool_project: project_url,
        cos_engine: cos.engine,
        cos_confidence: cos.confidence,
        audio_sha256: audioHash,
        c2pa_manifest_uri: manifestUri,
        nexus_telemetry: { contribution: c, invocations: log.length },
      },
    });

    return Response.json({ asset, c2pa_provenance_hash: c2paHash, anchoring: !!user.auto_anchor_provenance });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}