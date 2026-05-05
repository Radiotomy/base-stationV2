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
    const { trackId } = await req.json();
    if (!trackId) return Response.json({ error: 'trackId required' }, { status: 400 });
    const node = await getNode();
    const url = new URL(`${node}/v1/tracks/${trackId}`);
    url.searchParams.set('app_name', APP_NAME);
    const res = await fetch(url.toString());
    const json = await res.json();
    return Response.json({ data: json?.data || null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});