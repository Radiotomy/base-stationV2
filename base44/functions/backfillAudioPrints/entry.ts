import { createClientFromRequest } from 'npm:@base44/sdk@0.8.46';
import { extractPrintFromUrl, storePrint } from '../../shared/printRegistry.ts';
import { PRINT_VERSION } from '../../shared/basePrint.ts';

/**
 * Admin-only: build BASE Print REFERENCES for registered audio assets, in batches.
 *
 * WHY THIS EXISTS
 * buildAudioFingerprint prints one asset at a time, on request. Nothing ever
 * printed the back catalogue, so the reference registry was empty — and an empty
 * reference registry makes the Audius sweep structurally incapable of finding
 * anything. A sweep with no references does not return "nothing found", it
 * returns nothing AT ALL, which is why it refuses to run rather than reporting a
 * clean result.
 *
 * A Print writes nothing into the audio, so this is safe to run over
 * already-marked files and cannot disturb the BASE Mark cascade.
 *
 * ORDERING IS DELIBERATE: assets that carry a BASE Mark go first. Those are the
 * works with an actual provenance claim behind them, so they are the ones worth
 * being able to recognise in the wild.
 *
 * Payload: { batchSize?, dryRun? }
 */

const AUDIO_TYPES = new Set(['track', 'master', 'mashup', 'harmony', 'loop', 'stem']);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    // Capped: each print is a decode (often a remote container round trip), and a
    // timeout would throw away work already paid for.
    const batchSize = Math.min(Number(body.batchSize) || 3, 6);
    const dryRun = Boolean(body.dryRun);

    const [assets, prints] = await Promise.all([
      base44.asServiceRole.entities.UserAsset.list('-created_date', 400).catch(() => []),
      base44.asServiceRole.entities.AudioFingerprint
        .filter({ version: PRINT_VERSION }, '-created_date', 500)
        .catch(() => []),
    ]);

    const printed = new Set((prints || []).map((p: any) => p.asset_id));

    const eligible = (assets || [])
      .filter((a: any) => AUDIO_TYPES.has(a.asset_type))
      .filter((a: any) => !printed.has(a.id))
      .filter((a: any) => a.metadata?.base_mark?.marked_file_url || a.metadata?.wav_url || a.file_url)
      .sort((a: any, b: any) => {
        const am = a.metadata?.base_mark ? 1 : 0;
        const bm = b.metadata?.base_mark ? 1 : 0;
        return bm - am;
      });

    if (dryRun) {
      return Response.json({
        ok: true,
        dry_run: true,
        already_printed: printed.size,
        eligible: eligible.length,
        would_print: eligible.slice(0, batchSize).map((a: any) => ({
          asset_id: a.id,
          title: a.title,
          marked: Boolean(a.metadata?.base_mark),
        })),
      });
    }

    const results: any[] = [];
    for (const asset of eligible.slice(0, batchSize)) {
      // A PCM copy is the most reliable print source, and the V1-marked file is
      // PCM WAV by construction — same preference buildAudioFingerprint uses, so
      // both paths produce comparable references.
      const source = asset.metadata?.base_mark?.marked_file_url
        || asset.metadata?.wav_url
        || asset.file_url;
      try {
        const extract = await extractPrintFromUrl(source);
        if (!extract.ok) {
          results.push({ asset_id: asset.id, title: asset.title, ok: false, reason: extract.reason });
          continue;
        }
        await storePrint(base44, {
          asset_id: asset.id,
          user_id: asset.user_id,
          title: asset.title,
          source_url: source,
          content_class: 'music',
        }, extract);
        results.push({
          asset_id: asset.id,
          title: asset.title,
          ok: true,
          hash_count: extract.hash_count,
          duration_seconds: Math.round(extract.duration_seconds),
        });
      } catch (e: any) {
        // One unreadable asset must not end the batch — the rest are still worth printing.
        results.push({ asset_id: asset.id, title: asset.title, ok: false, reason: e.message });
      }
    }

    return Response.json({
      ok: true,
      printed: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      remaining: Math.max(0, eligible.length - results.length),
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});