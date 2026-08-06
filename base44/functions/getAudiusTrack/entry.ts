import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { annotateTrack } from '../../shared/audiusLicense.ts';
import { consumeIpRateLimit, rateLimitResponse } from '../../shared/rateLimit.ts';

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
    // Public by design (logged-out browsing), metered by IP so the Audius
    // quota on our API key can't be drained by an unmetered caller.
    const base44 = createClientFromRequest(req);
    const rl = await consumeIpRateLimit(base44, 'audius_public_read', req);
    if (!rl.allowed) return rateLimitResponse(rl, 'audius_public_read');

    const { trackId } = await req.json();
    if (!trackId) return Response.json({ error: 'trackId required' }, { status: 400 });
    const { base, headers, useAppName } = await resolveBase();
    const url = new URL(`${base}/tracks/${trackId}`);
    if (useAppName) url.searchParams.set('app_name', APP_NAME);
    const res = await fetch(url.toString(), { headers });
    const json = await res.json();
    return Response.json({ data: annotateTrack(json?.data || null) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});