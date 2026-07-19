import { annotateTracks } from '../../shared/audiusLicense.ts';

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
    const { genre, time = 'week' } = await req.json().catch(() => ({}));
    const { base, headers, useAppName } = await resolveBase();
    const url = new URL(`${base}/tracks/trending`);
    if (useAppName) url.searchParams.set('app_name', APP_NAME);
    url.searchParams.set('time', time);
    if (genre) url.searchParams.set('genre', genre);
    const res = await fetch(url.toString(), { headers });
    const json = await res.json();
    return Response.json({ data: annotateTracks(json?.data || []) });
  } catch (error) {
    return Response.json({ error: error.message, data: [] }, { status: 500 });
  }
});