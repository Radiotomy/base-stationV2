import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertSafeUrl } from '../../shared/safeUrl.ts';

// Downloads a Freesound preview and saves it as a permanent LoopSample in the
// user's library — CC-BY sounds automatically get their required attribution text.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      sound_id, name, username, license, preview_url, duration,
      tags, url, category, collection_name, make_public,
    } = await req.json();

    if (!preview_url) return Response.json({ error: 'Missing preview_url' }, { status: 400 });

    const safeUrl = assertSafeUrl(preview_url);
    const audioRes = await fetch(safeUrl);
    if (!audioRes.ok) throw new Error('Failed to download sound from Freesound');
    const blob = await audioRes.blob();
    const safeName = (name || 'sound').replace(/[^a-z0-9_-]+/gi, '_').slice(0, 60);
    const file = new File([blob], `${safeName}.mp3`, { type: 'audio/mpeg' });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    const licenseLower = (license || '').toLowerCase();
    const needsAttribution = licenseLower.includes('by') && !licenseLower.includes('cc0');

    const loop = await base44.entities.LoopSample.create({
      user_id: user.id,
      user_name: user.full_name,
      title: name || 'Untitled Sound',
      file_url,
      category: category || 'sample',
      source: 'freesound',
      duration_seconds: duration,
      tags: Array.isArray(tags) ? tags : [],
      collection_name: collection_name || 'Freesound Import',
      license: license || 'Unknown',
      attribution: needsAttribution ? `"${name}" by ${username} (freesound.org) — licensed ${license}` : '',
      external_id: sound_id ? String(sound_id) : '',
      external_url: url || '',
      is_public: !!make_public,
    });

    return Response.json({ ok: true, loop });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}