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

async function searchOne(query, orientation) {
  const orient = ['landscape', 'portrait', 'square'].includes(orientation) ? orientation : 'landscape';
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=1&orientation=${orient}`;
  const res = await fetch(url, { headers: { Authorization: PEXELS_KEY } });
  if (!res.ok) return null;
  const data = await res.json();
  const video = data.videos?.[0];
  if (!video) return null;
  return {
    image: video.image,
    photographer: video.user?.name || null,
    photographer_url: video.user?.url || null,
    pexels_url: video.url || null,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!PEXELS_KEY) return Response.json({ error: 'PEXELS_API_KEY not configured' }, { status: 500 });

    const { queries, orientation } = await req.json();
    if (!Array.isArray(queries)) {
      return Response.json({ error: 'queries[] required' }, { status: 400 });
    }
    const limited = queries.slice(0, 12);

    const results = await Promise.all(
      limited.map(async (q) => {
        const hit = q?.trim() ? await searchOne(q, orientation) : null;
        return {
          query: q,
          thumbnail_url: hit?.image || null,
          photographer: hit?.photographer || null,
          photographer_url: hit?.photographer_url || null,
          pexels_url: hit?.pexels_url || null,
        };
      })
    );

    return Response.json({ previews: results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});