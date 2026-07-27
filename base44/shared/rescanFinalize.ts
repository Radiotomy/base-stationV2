// Shared forensic re-scan evaluation + auto-flag logic, used by both the
// synchronous (V1-only) completion path in rescanAssetMark and the async
// V2 completion path in pollRescanAssetMark.
//
// `results` is { v1, v2 } where each entry is either null or
//   { detected, payload_hex, match, inconclusive?, error? }
// A layer is "conclusive" once it has run AND is neither inconclusive (e.g. a
// non-WAV file defeating the V1 RIFF parser) nor in error (e.g. a transient
// Replicate outage). A flag is raised only when at least one conclusive layer
// FAILED to recover the registered payload — inconclusive/error layers are
// skipped to avoid false tamper alarms from format or infra limitations.
// Flag creation is idempotent: an open (reported/investigating) auto-rescan
// flag whose description already carries this asset's id is left in place.

export async function evaluateRescan(base44, asset, results) {
  const conclusive = Object.entries(results).filter(
    ([, r]) => r && !(r.inconclusive || r.error)
  );
  const any_failed = conclusive.some(([, r]) => !r.match);

  if (!any_failed || conclusive.length === 0) {
    return { any_failed, flag_created: false, flag_id: null, conclusive_count: conclusive.length };
  }

  const v2Reg = asset.metadata?.base_mark_v2?.payload_hex || null;
  const v1Reg = asset.metadata?.base_mark?.payload_hex || null;

  const failed = conclusive.filter(([, r]) => !r.match);
  const parts = failed.map(([k, r]) =>
    r.detected ? `${k} payload mismatch (got ${r.payload_hex || 'none'})` : `${k} not detected`
  );
  const description =
    `Automated forensic re-scan failed for asset "${asset.title}" (id ${asset.id}). ` +
    `Registered: ${v2Reg ? `V2=${v2Reg} ` : ''}${v1Reg ? `V1=${v1Reg}` : ''}. ` +
    `Failures: ${parts.join('; ')}.`;

  const existing = await base44.asServiceRole.entities.TransparencyFlag.filter(
    { user_id: asset.user_id, track_title: asset.title },
    '-created_date',
    20,
  );
  const dup = (existing || []).some(
    (f) => ['reported', 'investigating'].includes(f.status) && (f.description || '').includes(asset.id)
  );
  if (dup) {
    return { any_failed, flag_created: false, flag_id: null, duplicate: true, conclusive_count: conclusive.length };
  }

  const cos = typeof asset.human_participation_score === 'number' ? asset.human_participation_score : null;
  const flag = await base44.asServiceRole.entities.TransparencyFlag.create({
    user_id: asset.user_id,
    user_name: asset.user_email || '',
    track_title: asset.title,
    platform: 'other',
    cos_score: cos,
    had_manifest: true,
    description,
    status: 'reported',
  });
  return { any_failed, flag_created: true, flag_id: flag.id, conclusive_count: conclusive.length };
}