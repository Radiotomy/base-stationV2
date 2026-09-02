import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { listVoicebanks } from '../../shared/diffSinger.ts';
import { loadVoicebankRows, canUseBank, bankOwnership } from '../../shared/voicebankAccess.ts';

/**
 * Which singing voices THIS creator may render with on the Cantor engine.
 *
 * Returns: { data: { voicebanks: [...] } }
 *
 * Discovered at runtime rather than hardcoded: voicebanks are installed on the
 * Space, each carries its own licence, and a stale hardcoded list would offer a
 * voice that cannot render. The engine's list is then filtered through the
 * Voicebank registry so another creator's private upload is never shown.
 */
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const [engineBanks, rows] = await Promise.all([listVoicebanks(), loadVoicebankRows(base44)]);
    const voicebanks = engineBanks
      .filter((b) => canUseBank(b.id, rows, user))
      .map((b) => ({ ...b, ownership: bankOwnership(b.id, rows, user) }));

    return Response.json({ data: { voicebanks } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}