import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { detectMark } from '../../shared/baseMark.ts';
import { assertSafeUrl } from '../../shared/safeUrl.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { fileUrl } = await req.json();
    if (!fileUrl) return Response.json({ error: 'fileUrl is required' }, { status: 400 });

    // SSRF guard — reject non-http(s), IP-literal, loopback, and internal hosts
    let safeUrl;
    try {
      safeUrl = assertSafeUrl(fileUrl);
    } catch (e) {
      return Response.json({ error: e.message }, { status: 400 });
    }

    const dl = await fetch(safeUrl, { redirect: 'error' });
    if (!dl.ok) return Response.json({ error: 'Could not download the audio file' }, { status: 502 });
    const bytes = new Uint8Array(await dl.arrayBuffer());

    const result = detectMark(bytes);

    let matches = [];
    if (result.detected && result.payload_hex) {
      const rows = await base44.asServiceRole.entities.UserAsset.filter(
        { 'metadata.base_mark.payload_hex': result.payload_hex },
        '-created_date',
        5
      );
      matches = rows.map((a) => ({
        id: a.id,
        title: a.title,
        asset_type: a.asset_type,
        created_date: a.created_date,
        marked_at: a.metadata?.base_mark?.embedded_at || null,
        is_own: a.user_id === user.id,
      }));
    }

    // Never expose internal detector diagnostics (alignment offset, pilot
    // correlation thresholds) — creator-facing fields only.
    const { pilot_score: _p, sample_offset: _o, ...safe } = result;
    return Response.json({ ...safe, matches });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});