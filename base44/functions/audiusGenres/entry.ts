import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { AUDIUS_GENRES, normalizeAudiusGenre } from '../../shared/audiusMetadata.ts';

// The one genre list the app offers — served from the same module the release
// is validated against, so the picker can never offer a genre the server rejects.
// Optional `tags` returns the genre those project tags resolve to.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { tags = [] } = await req.json().catch(() => ({}));
    const list = (Array.isArray(tags) ? tags : []).map((t) => String(t).slice(0, 40)).slice(0, 10);
    const suggested = list.map((t) => normalizeAudiusGenre(t, '')).find(Boolean) || '';
    return Response.json({ genres: AUDIUS_GENRES, suggested });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}