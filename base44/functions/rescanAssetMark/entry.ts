import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { detectMark } from '../../shared/baseMark.ts';
import { runV2, unpackMessage } from '../../shared/baseMarkV2.ts';
import { assertSafeUrl } from '../../shared/safeUrl.ts';

// Forensic re-scan of a REGISTERED asset's own audio.
//
// The asset claims one or both BASE Mark layers (V1 acoustic, V2 neural) in its
// metadata. We re-run the detectors against the asset's current stored audio
// and compare the recovered payload to the registered one. If a layer ran
// conclusively and did NOT produce a matching payload, the mark is no longer
// recoverable from the distributed file — a tamper / integrity signal that
// must be triaged, not silently lost. We auto-create a TransparencyFlag
// (platform=other) attributed to the asset owner, skipping creation when an
// open auto-rescan flag for this asset already exists (idempotent).
//
// V2 re-scan is format-agnostic (Replicate decodes via librosa). V1 re-scan
// needs a RIFF/WAVE container in memory; a parse failure on a non-WAV file is
// treated as INCONCLUSIVE (not a tamper signal) so we never auto-flag on a
// format limitation.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { assetId } = await req.json();
    if (!assetId) return Response.json({ error: 'assetId is required' }, { status: 400 });

    const asset = await base44.entities.UserAsset.get(assetId);
    if (!asset) return Response.json({ error: 'Asset not found' }, { status: 404 });

    const v2Reg = asset.metadata?.base_mark_v2?.payload_hex || null;
    const v1Reg = asset.metadata?.base_mark?.payload_hex || null;
    if (!v2Reg && !v1Reg) {
      return Response.json({ registered: false, flag_created: false, message: 'No registered BASE Mark on this asset' });
    }

    const rawUrl = asset.metadata?.base_mark_v2?.original_file_url || asset.metadata?.wav_url || asset.file_url;
    let safeUrl;
    try { safeUrl = assertSafeUrl(rawUrl); } catch (e) { return Response.json({ error: e.message }, { status: 400 }); }

    const scanUrl = safeUrl.toString();
    const results = { v1: null, v2: null };

    // --- V2 neural re-scan (format-agnostic via Replicate) ---
    if (v2Reg) {
      try {
        const output = await runV2({ action: 'decode', audio: scanUrl });
        const resultUrl = typeof output === 'string' ? output : Array.isArray(output) ? output[0] : output?.url;
        if (!resultUrl) {
          results.v2 = { detected: false, payload_hex: null, match: false, error: 'no result url' };
        } else {
          const rr = await fetch(resultUrl);
          if (!rr.ok) {
            results.v2 = { detected: false, payload_hex: null, match: false, error: 'result unreadable' };
          } else {
            const v2 = await rr.json();
            if (v2.detected && Array.isArray(v2.messages) && v2.messages.length > 0) {
              const { valid, payload_hex } = unpackMessage(v2.messages[0]);
              results.v2 = { detected: valid, payload_hex: valid ? payload_hex : null, match: valid && payload_hex === v2Reg };
            } else {
              results.v2 = { detected: false, payload_hex: null, match: false };
            }
          }
        }
      } catch (e) {
        results.v2 = { detected: false, payload_hex: null, match: false, error: e.message };
      }
    }

    // --- V1 acoustic re-scan (in-memory, requires RIFF/WAVE) ---
    if (v1Reg) {
      try {
        const dl = await fetch(scanUrl, { redirect: 'error' });
        if (!dl.ok) {
          results.v1 = { detected: false, payload_hex: null, match: false, inconclusive: true, error: 'download failed' };
        } else {
          const bytes = new Uint8Array(await dl.arrayBuffer());
          const v1 = detectMark(bytes);
          results.v1 = { detected: v1.detected, payload_hex: v1.payload_hex || null, match: v1.detected && v1.payload_hex === v1Reg };
        }
      } catch (e) {
        // Non-WAV / RIFF parse failure = inconclusive, NOT a tamper signal.
        results.v1 = { detected: false, payload_hex: null, match: false, inconclusive: true, error: e.message };
      }
    }

    // --- Decide: did any conclusive layer fail to match? ---
    const conclusive = Object.entries(results).filter(([, r]) => r && !(r.inconclusive || r.error));
    const anyFailed = conclusive.some(([, r]) => !r.match);

    let flag_created = false;
    let flag_id = null;

    if (anyFailed && conclusive.length > 0) {
      const failed = conclusive.filter(([, r]) => !r.match);
      const parts = failed.map(([k, r]) =>
        r.detected ? `${k} payload mismatch (got ${r.payload_hex || 'none'})` : `${k} not detected`
      );
      const description =
        `Automated forensic re-scan failed for asset "${asset.title}" (id ${asset.id}). ` +
        `Registered: ${v2Reg ? `V2=${v2Reg} ` : ''}${v1Reg ? `V1=${v1Reg}` : ''}. ` +
        `Failures: ${parts.join('; ')}.`;

      // Idempotency — skip if an open auto-rescan flag for THIS asset exists.
      const existing = await base44.asServiceRole.entities.TransparencyFlag.filter(
        { user_id: asset.user_id, track_title: asset.title },
        '-created_date',
        20,
      );
      const dup = (existing || []).some(
        (f) => ['reported', 'investigating'].includes(f.status) && (f.description || '').includes(asset.id)
      );

      if (!dup) {
        const flag = await base44.asServiceRole.entities.TransparencyFlag.create({
          user_id: asset.user_id,
          user_name: asset.user_email || '',
          track_title: asset.title,
          platform: 'other',
          cos_score: typeof asset.human_participation_score === 'number' ? asset.human_participation_score : null,
          had_manifest: true,
          description,
          status: 'reported',
        });
        flag_created = true;
        flag_id = flag.id;
      }
    }

    return Response.json({
      registered: true,
      v2_registered: !!v2Reg,
      v1_registered: !!v1Reg,
      results,
      any_failed: anyFailed,
      flag_created,
      flag_id,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});