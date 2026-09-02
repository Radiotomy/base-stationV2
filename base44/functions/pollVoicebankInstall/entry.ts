import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { getCantorInstallStatus } from '../../shared/diffSinger.ts';

/**
 * Poll a Cantor voicebank install and finalize its registry row.
 *
 * Payload: { voicebank_id }
 * Returns: { status: 'processing', stage } | { status: 'installed', voicebank } | { status: 'failed', error }
 *
 * 'installed' is written only after the engine reports a completed validation
 * render. The engine's report (input names, speakers, licence excerpt, vocoder
 * source) is stored verbatim so an admin can diagnose a bank without SSH.
 */
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { voicebank_id } = await req.json();
    if (!voicebank_id) return Response.json({ error: 'voicebank_id required' }, { status: 400 });

    const row = (await base44.asServiceRole.entities.Voicebank.filter({ id: voicebank_id }))[0];
    if (!row) return Response.json({ error: 'Voicebank not found' }, { status: 404 });
    if (row.user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (row.status === 'installed') return Response.json({ status: 'installed', voicebank: row });
    if (row.status === 'failed') return Response.json({ status: 'failed', error: row.error_message });

    const result = await getCantorInstallStatus(row.engine_job_id);
    // A sleeping or rebuilding engine is not a failed install — keep polling.
    if (!result) return Response.json({ status: 'processing', stage: 'engine waking' });

    if (result.status === 'failed') {
      const error = result.error || 'The engine rejected this voicebank';
      await base44.asServiceRole.entities.Voicebank.update(row.id, { status: 'failed', error_message: error });
      return Response.json({ status: 'failed', error });
    }
    if (result.status !== 'completed') {
      return Response.json({ status: 'processing', stage: result.stage || result.status });
    }

    const report = result.report || {};
    const updated = await base44.asServiceRole.entities.Voicebank.update(row.id, {
      status: 'installed',
      name: report.name && row.name === row.bank_id ? report.name : row.name,
      language: report.language || row.language || '',
      license_text: String(report.license || '').slice(0, 4000),
      report,
    });
    return Response.json({ status: 'installed', voicebank: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}