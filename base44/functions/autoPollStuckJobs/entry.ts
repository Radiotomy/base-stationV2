import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { finalizeJob } from '../../shared/jobFinalize.ts';

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
    const stuck = await base44.asServiceRole.entities.GenerationJob.filter(
      { status: 'processing' }, '-created_date', 100
    ).catch(() => []);

    const toProcess = stuck.filter(j => j.provider_job_id && j.created_date < cutoff);

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

    return Response.json({
      success: true,
      scanned: stuck.length,
      candidates: toProcess.length,
      finalized,
      errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});