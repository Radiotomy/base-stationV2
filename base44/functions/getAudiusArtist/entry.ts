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

async function get(node, path, params = {}) {
  const url = new URL(`${node}/v1${path}`);
  url.searchParams.set('app_name', APP_NAME);
  Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) return { data: null };
  return await res.json();
}

Deno.serve(async (req) => {
  try {
    const { userId } = await req.json();
    if (!userId) return Response.json({ error: 'userId required' }, { status: 400 });
    const node = await getNode();
    const [profile, tracks] = await Promise.all([
      get(node, `/users/${userId}`),
      get(node, `/users/${userId}/tracks`),
    ]);
    return Response.json({
      data: {
        profile: profile?.data || null,
        tracks: tracks?.data || [],
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});