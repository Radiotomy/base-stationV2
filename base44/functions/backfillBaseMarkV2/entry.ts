import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { payloadFromId } from '../../shared/baseMark.ts';
import { packMessage, startV2, v2Model, BASE_MARK_V2_VERSION } from '../../shared/baseMarkV2.ts';
import { assertSafeUrl } from '../../shared/safeUrl.ts';

// One-shot backfill for the pre-automation catalogue.
//
// The auto-marking workflow triggers on asset CREATE, so it only ever covered
// assets made after it went live. Everything created before that — 45 tracks as
// of 2026-08-09, all May/June/July, 44 of which carry no spectral layer either —
// has never been through the neural layer at all. This dispatches those embeds
// in controlled batches.
//
// It also picks up assets whose last embed FAILED (opt-in), which is how the
// three 48kHz masters rejected by the integrity guard get retried once the
// rate-preserving container is pushed.
//
// Deliberately NOT a workflow: this is an operator action with a real per-run
// GPU cost that should be run deliberately, watched, and stopped if the first
// batch misbehaves — not something that fires on a schedule.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(parseInt(body.limit, 10) || 5, 1), 25);
    const dryRun = body.dryRun !== false; // default to a dry run — dispatching costs GPU time
    const includeFailed = !!body.includeFailed;

    // Page through tracks rather than assuming one page covers the catalogue.
    const all = [];
    for (let skip = 0; skip < 2000; skip += 200) {
      const page = await base44.asServiceRole.entities.UserAsset.filter(
        { asset_type: 'track' },
        '-created_date',
        200,
        skip,
      );
      if (!page?.length) break;
      all.push(...page);
      if (page.length < 200) break;
    }

    const candidates = all.filter((a) => {
      const status = a.metadata?.base_mark_v2?.status;
      if (!status) return true;
      return includeFailed && status === 'failed';
    });

    const eligible = [];
    const skipped = [];
    for (const a of candidates) {
      const url = a.metadata?.wav_url || a.file_url;
      if (!url) {
        skipped.push({ id: a.id, title: a.title, reason: 'no audio file' });
        continue;
      }
      try {
        assertSafeUrl(url);
      } catch (e) {
        skipped.push({ id: a.id, title: a.title, reason: e.message });
        continue;
      }
      eligible.push({ asset: a, url });
    }

    if (dryRun) {
      return Response.json({
        ok: true,
        dry_run: true,
        remaining: eligible.length,
        skipped,
        would_dispatch: eligible.slice(0, limit).map(({ asset }) => ({
          id: asset.id,
          title: asset.title,
          created_date: asset.created_date,
          previous_status: asset.metadata?.base_mark_v2?.status || null,
        })),
      });
    }

    // Dispatch serially. Each embed is a GPU prediction, and firing a whole
    // batch at once on a cold model is how you turn one slow start into N of them.
    const dispatched = [];
    const failed = [];
    for (const { asset, url } of eligible.slice(0, limit)) {
      try {
        const payloadHex = payloadFromId(asset.id);
        const pred = await startV2({
          action: 'encode',
          audio: url,
          message: JSON.stringify(packMessage(payloadHex)),
        });
        await base44.asServiceRole.entities.UserAsset.update(asset.id, {
          metadata: {
            ...(asset.metadata || {}),
            base_mark_v2: {
              version: BASE_MARK_V2_VERSION,
              engine: 'neural',
              model: v2Model(),
              payload_hex: payloadHex,
              status: 'processing',
              prediction_id: pred.id,
              original_file_url: url,
              embedded_at: new Date().toISOString(),
              backfill: true,
            },
          },
        });
        dispatched.push({ id: asset.id, title: asset.title, prediction_id: pred.id });
      } catch (e) {
        failed.push({ id: asset.id, title: asset.title, error: e.message });
      }
    }

    return Response.json({
      ok: true,
      dry_run: false,
      dispatched,
      failed,
      remaining: Math.max(eligible.length - dispatched.length, 0),
      note: 'Predictions settle via the Replicate webhook; re-run to continue the backlog.',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}