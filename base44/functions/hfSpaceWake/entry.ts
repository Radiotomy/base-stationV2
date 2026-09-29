import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Self-hosted Hugging Face Space engines. Free/idle Spaces sleep after ~48h of
// inactivity; any HTTP request to the Space wakes it (cold boot takes minutes).
const SPACES: Record<string, string> = {
  nexus_bridge: Deno.env.get('AUDIOTOOL_BRIDGE_URL') || '',
  aurora: 'https://radiotomy-aurora.hf.space',
  cadence: 'https://radiotomy-cadence.hf.space',
  cantor: 'https://radiotomy-cantor.hf.space',
  clap: 'https://radiotomy-clap.hf.space',
  coda: 'https://radiotomy-coda.hf.space',
  inspire: Deno.env.get('INSPIRE_ENGINE_URL') || 'https://radiotomy-inspire.hf.space',
  ltx_engine: 'https://radiotomy-basestation-ltx-engine.hf.space',
  nova_h3: 'https://radiotomy-nova-h3.hf.space',
  scribe: 'https://radiotomy-scribe.hf.space',
  sever: 'https://radiotomy-sever.hf.space',
  siren_song: 'https://radiotomy-sirens-song.hf.space',
  skye: 'https://radiotomy-skye.hf.space',
};

async function probe(url: string, timeoutMs: number) {
  const base = url.replace(/\/$/, '');
  const start = Date.now();
  try {
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(timeoutMs) });
    const text = await res.text();
    let json = true;
    try { JSON.parse(text); } catch { json = false; }
    // A sleeping/booting Space answers with an HTML placeholder or 503.
    const status = res.ok && json ? 'running' : res.status === 404 ? 'not_found' : 'asleep';
    return { status, http: res.status, latency_ms: Date.now() - start };
  } catch {
    return { status: 'asleep', http: 0, latency_ms: Date.now() - start };
  }
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { action = 'status', space } = await req.json().catch(() => ({}));
  const names = space ? [space] : Object.keys(SPACES);
  if (names.some((n) => !(n in SPACES))) return Response.json({ error: 'Unknown space' }, { status: 400 });

  const results = await Promise.all(names.map(async (name) => {
    const url = SPACES[name];
    if (!url) return { name, status: 'unconfigured' };
    // Status = quick probe. Wake = same request with a longer wait, which is
    // itself what triggers Hugging Face to boot the sleeping Space.
    const r = await probe(url, action === 'wake' ? 25000 : 6000);
    return { name, ...r, waking: action === 'wake' && r.status !== 'running' };
  }));

  return Response.json({ spaces: results });
});