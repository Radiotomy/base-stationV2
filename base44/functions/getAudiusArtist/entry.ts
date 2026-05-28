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

async function get(ctx, path) {
  const url = new URL(`${ctx.base}${path}`);
  if (ctx.useAppName) url.searchParams.set('app_name', APP_NAME);
  const res = await fetch(url.toString(), { headers: ctx.headers });
  if (!res.ok) return { data: null };
  return await res.json();
}

Deno.serve(async (req) => {
  try {
    const { userId } = await req.json();
    if (!userId) return Response.json({ error: 'userId required' }, { status: 400 });
    const ctx = await resolveBase();
    const [profile, tracks] = await Promise.all([
      get(ctx, `/users/${userId}`),
      get(ctx, `/users/${userId}/tracks`),
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