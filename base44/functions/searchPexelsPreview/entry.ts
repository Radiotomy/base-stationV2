// searchPexelsPreview — given a list of queries, returns one Pexels video
// thumbnail image URL per query so the storyboard UI can render previews of
// what each scene will look like before paying to render.
//
// Payload: { queries: string[] }    // up to 12
// Returns: { previews: { query, thumbnail_url }[] }
//
// Pexels is free for this and doesn't count against credits. Auth uses
// PEXELS_API_KEY secret.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PEXELS_KEY = Deno.env.get('PEXELS_API_KEY');

async function searchOne(query) {
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`;
  const res = await fetch(url, { headers: { Authorization: PEXELS_KEY } });
  if (!res.ok) return null;
  const data = await res.json();
  const video = data.videos?.[0];
  return video?.image || null; // Pexels exposes a still preview frame as `image`
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!PEXELS_KEY) return Response.json({ error: 'PEXELS_API_KEY not configured' }, { status: 500 });

    const { queries } = await req.json();
    if (!Array.isArray(queries)) {
      return Response.json({ error: 'queries[] required' }, { status: 400 });
    }
    const limited = queries.slice(0, 12);

    const results = await Promise.all(
      limited.map(async (q) => ({
        query: q,
        thumbnail_url: q?.trim() ? await searchOne(q) : null,
      }))
    );

    return Response.json({ previews: results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});