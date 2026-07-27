import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

// Searches Freesound.org's free, royalty-free sound library for loops/samples.
// Returns lightweight preview data — actual download/import happens in importFreesoundSound.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { query = '', category = '', page = 1 } = await req.json();
    const apiKey = secrets.get('FREESOUND_API_KEY');
    if (!apiKey) return Response.json({ error: 'Freesound is not configured' }, { status: 500 });

    const searchQuery = [query, category].filter(Boolean).join(' ').trim() || 'loop';
    const params = new URLSearchParams({
      query: searchQuery,
      token: apiKey,
      page: String(page || 1),
      page_size: '24',
      fields: 'id,name,username,previews,duration,tags,license,url',
      filter: 'duration:[0.1 TO 30]',
    });

    const res = await fetch(`https://freesound.org/apiv2/search/text/?${params.toString()}`);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Freesound search failed: ${res.status} ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    const results = (data.results || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      username: r.username,
      preview_url: r.previews?.['preview-hq-mp3'] || r.previews?.['preview-lq-mp3'],
      duration: r.duration,
      tags: r.tags,
      license: r.license,
      url: r.url,
    }));

    return Response.json({ results, count: data.count, has_more: !!data.next });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}