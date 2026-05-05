const APP_NAME = 'BaseStation';
const DEFAULT_NODE = 'https://discoveryprovider.audius.co';

async function getNode() {
  const override = Deno.env.get('AUDIUS_NODE_URL');
  if (override) return override;
  try {
    const r = await fetch('https://api.audius.co');
    const j = await r.json();
    return j?.data?.[0] || DEFAULT_NODE;
  } catch {
    return DEFAULT_NODE;
  }
}

Deno.serve(async (req) => {
  try {
    const { query, limit = 20 } = await req.json();
    if (!query) return Response.json({ data: [] });
    const node = await getNode();
    const url = new URL(`${node}/v1/tracks/search`);
    url.searchParams.set('app_name', APP_NAME);
    url.searchParams.set('query', query);
    url.searchParams.set('limit', String(limit));
    const res = await fetch(url.toString());
    const json = await res.json();
    return Response.json({ data: json?.data || [] });
  } catch (error) {
    return Response.json({ error: error.message, data: [] }, { status: 500 });
  }
});