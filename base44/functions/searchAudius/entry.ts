const MANAGED_GATEWAY = 'https://api.audius.co/v1';
const DEFAULT_DISCOVERY = 'https://discoveryprovider.audius.co';
const APP_NAME = 'BaseStation';

async function resolveBase() {
  const apiKey = Deno.env.get('AUDIUS_API_KEY');
  if (apiKey && apiKey.length > 8) {
    return { base: MANAGED_GATEWAY, headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' }, useAppName: false };
  }
  try {
    const r = await fetch('https://api.audius.co');
    const j = await r.json();
    const node = j?.data?.[0] || DEFAULT_DISCOVERY;
    return { base: `${node}/v1`, headers: { 'Accept': 'application/json' }, useAppName: true };
  } catch {
    return { base: `${DEFAULT_DISCOVERY}/v1`, headers: { 'Accept': 'application/json' }, useAppName: true };
  }
}

Deno.serve(async (req) => {
  try {
    const { query, limit = 20 } = await req.json();
    if (!query) return Response.json({ data: [] });
    const { base, headers, useAppName } = await resolveBase();
    const url = new URL(`${base}/tracks/search`);
    if (useAppName) url.searchParams.set('app_name', APP_NAME);
    url.searchParams.set('query', query);
    url.searchParams.set('limit', String(limit));
    const res = await fetch(url.toString(), { headers });
    const json = await res.json();
    return Response.json({ data: json?.data || [] });
  } catch (error) {
    return Response.json({ error: error.message, data: [] }, { status: 500 });
  }
});