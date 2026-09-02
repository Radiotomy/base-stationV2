import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { submitCantorInstall, removeCantorVoicebank } from '../../shared/diffSinger.ts';
import { assertSafeUrl } from '../../shared/safeUrl.ts';

/**
 * Ingest an OpenUtau-format DiffSinger voicebank into the Cantor engine.
 *
 * Payload: {
 *   zip_url:      https URL of the bank archive (a Base44 upload or a direct download),
 *   name?:        display name,
 *   bank_id?:     engine folder id (derived from name when omitted),
 *   is_platform?: admin only — visible to every creator,
 *   kind?:        'voicebank' (default) | 'vocoder' (admin only — shared mel→wave model),
 *   replace?:     overwrite an existing install (own bank, or admin),
 * }
 * Returns: { data: { voicebank_id, engine_job_id, bank_id, status: 'processing' } }
 *
 * Validation happens ON THE ENGINE, where onnxruntime lives: it binds the acoustic and
 * vocoder inputs by name and performs a short test render before the bank is kept. A
 * half-installed bank is therefore an error, never a voice. This function only decides
 * WHO may install WHAT and records the outcome; pollVoicebankInstall finalizes the row.
 */

function slug(s: string): string {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const isAdmin = user.role === 'admin';
    const kind = body.kind === 'vocoder' ? 'vocoder' : 'voicebank';
    const isPlatform = Boolean(body.is_platform);
    const replace = Boolean(body.replace);

    if ((isPlatform || kind === 'vocoder') && !isAdmin) {
      return Response.json({ error: 'Only an admin can install platform defaults or shared vocoders' }, { status: 403 });
    }

    let zipUrl: string;
    try { zipUrl = assertSafeUrl(String(body.zip_url || '')); }
    catch (e) { return Response.json({ error: `zip_url: ${e.message}` }, { status: 400 }); }

    const name = String(body.name || '').trim();
    let bankId = slug(body.bank_id || name);
    if (!bankId) return Response.json({ error: 'Give the voicebank a name' }, { status: 400 });
    // Creator uploads are namespaced so two creators' "my-voice" cannot collide,
    // and so a creator can never overwrite a platform default by picking its id.
    if (!isPlatform && kind === 'voicebank') bankId = `u${String(user.id).slice(0, 6)}-${bankId}`;

    const existing = (await base44.asServiceRole.entities.Voicebank.filter({ bank_id: bankId }))[0];
    if (existing && existing.status !== 'failed') {
      const owns = existing.user_id === user.id || isAdmin;
      if (!owns) return Response.json({ error: 'That voicebank id belongs to someone else' }, { status: 409 });
      if (!replace) return Response.json({ error: `'${bankId}' is already installed — choose "replace" to overwrite it` }, { status: 409 });
    }

    const hfToken = secrets.get('HF_TOKEN');
    if (!hfToken) return Response.json({ error: 'Engine credentials are not configured' }, { status: 500 });

    if (replace && existing && kind === 'voicebank') {
      await removeCantorVoicebank(bankId, hfToken).catch(() => {});
    }

    const engineJobId = await submitCantorInstall({ bankId, zipUrl, kind, replace, hfToken });

    const fields = {
      user_id: user.id,
      user_email: user.email,
      bank_id: bankId,
      name: name || bankId,
      kind,
      zip_url: zipUrl,
      is_platform: isPlatform,
      status: 'processing',
      error_message: '',
      engine_job_id: engineJobId,
      report: {},
    };
    const row = existing
      ? await base44.asServiceRole.entities.Voicebank.update(existing.id, fields)
      : await base44.asServiceRole.entities.Voicebank.create(fields);

    return Response.json({
      data: { voicebank_id: row.id, engine_job_id: engineJobId, bank_id: bankId, status: 'processing' },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}