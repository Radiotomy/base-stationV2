// Protect & Register an Audiotool export. Audiotool renders exports itself and
// offers no hook to intercept them, so the creator brings the exported file here.
// Creating the library record is what starts the existing provenance pipeline:
// BASE Mark embedding and (for opted-in creators) the Base mainnet anchor both
// trigger automatically on a new track asset.
import { base44 } from '@/api/base44Client';
import { calculateHumanParticipationScore } from '@/utils/participationScore';

export async function protectExport({ user, file, title, projectUrl, log, contribution }) {
  const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });

  const longestPrompt = log.reduce((a, e) => ((e.prompt || '').length > a.length ? e.prompt : a), '');
  const cos = await calculateHumanParticipationScore({
    prompt: longestPrompt,
    userProvidedContent: contribution.humanNotes > contribution.aiNotes,
    humanInstrumentPerformance: contribution.humanNotes > 0,
    isIteration: log.length > 1,
    styleOrTags: [],
    referenceFile: false,
    personaOrTemplate: false,
    hasSyntheticVocals: false,
    isAutomatedMaster: false,
  });

  // No AI invocation observed through the bridge is NOT proof of a human-only
  // recording — it is recorded as unverified, never as ai_generated or human.
  const label = log.length ? cos.label : 'unverified';
  const basis = log.length
    ? `${cos.basis} Audiotool session: ${contribution.humanShare ?? 0}% of notes/devices human-made, ${log.length} AI invocation(s) logged.`
    : 'No AI invocations were recorded through the Audiotool Bridge for this project.';

  return base44.entities.UserAsset.create({
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
    tags: ['audiotool'],
    metadata: {
      source: 'audiotool_bridge',
      audiotool_project: projectUrl,
      cos_engine: cos.engine,
      cos_confidence: cos.confidence,
      nexus_telemetry: {
        contribution,
        invocations: log.slice(-50).map(({ tool, prompt, at }) => ({ tool, prompt, at })),
      },
    },
  });
}