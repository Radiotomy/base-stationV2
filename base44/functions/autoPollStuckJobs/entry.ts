import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { finalizeJob } from '../../shared/jobFinalize.ts';
import { cancelStuckSirenSongPredictions } from '../../shared/sirenSong.ts';

/**
 * Safety-net poller — scheduled every 5 minutes.
 *
 * Interactive polling (pollGenerationJob) only runs while the user's browser
 * tab is open. If a generation takes longer than expected and the user
 * navigates away or closes the tab, the job is never polled again — and
 * providers like Replicate purge completed output after a retention window,
 * making the result unrecoverable. This automation catches any job still
 * "processing" a few minutes after it started and finalizes it server-side,
 * across all users, before that window closes.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Scheduled automations invoke with platform admin auth context.
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    // OLDEST first. This is a safety net against provider retention windows, so the
    // job nearest to having its output purged is the one that must be finalized
    // first — newest-first ordering worked against the entire point of the sweep.
    const stuck = await base44.asServiceRole.entities.GenerationJob.filter(
      { status: 'processing' }, 'created_date', 100
    ).catch(() => []);

    const candidates = stuck.filter(j => j.provider_job_id && j.created_date < cutoff);

    // Finalizing a job can hold an entire master in memory to re-host it (the
    // persist ceiling alone is 120MB), and this worker has one memory budget for
    // the whole invocation. Draining every candidate in one pass is what was
    // getting the isolate OOM-killed — which reported as a bare "user worker threw
    // an exception" and finalized NOTHING, so the same backlog retried forever and
    // jobs still aged out of their provider's retention window.
    //
    // A small batch per run keeps peak memory bounded and lets the 5-minute cadence
    // drain the queue instead: slower per run, but it actually completes.
    const BATCH = 3;
    const toProcess = candidates.slice(0, BATCH);

    let finalized = 0;
    const errors = [];
    for (const job of toProcess) {
      try {
        // Pass the plain admin-scoped client (not .asServiceRole) — finalizeJob
        // internally elevates via base44.asServiceRole.* where needed, so the
        // param it receives must still expose a nested asServiceRole.
        const result = await finalizeJob(base44, job);
        if (result?.status === 'completed' || result?.status === 'failed') finalized += 1;
      } catch (err) {
        errors.push({ job_id: job.id, error: err.message });
      }
    }

    // Reap stranded Siren Song predictions on the same 5-minute cadence.
    // Deliberately independent of the job loop above: a boot-crash loop bills
    // 2x-L40S time while retrying setup(), and it can happen with no matching
    // GenerationJob row at all (a probe, or a job already finalized as failed).
    // Its own failure must never abort the job sweep, so it is caught here.
    let sirenSong = null;
    try {
      sirenSong = await cancelStuckSirenSongPredictions();
    } catch (err) {
      errors.push({ job_id: 'siren_song_sweep', error: err.message });
    }

    return Response.json({
      success: true,
      scanned: stuck.length,
      candidates: candidates.length,
      attempted: toProcess.length,
      // Anything left over is picked up by the next run. Reported so a backlog that
      // never drains is visible rather than silently deferred forever.
      deferred: Math.max(0, candidates.length - toProcess.length),
      finalized,
      siren_song: sirenSong,
      errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});