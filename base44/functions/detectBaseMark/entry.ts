import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { detectMark } from '../../shared/baseMark.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { fileUrl } = await req.json();
    if (!fileUrl) return Response.json({ error: 'fileUrl is required' }, { status: 400 });

    const dl = await fetch(fileUrl);
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

    return Response.json({ ...result, matches });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});