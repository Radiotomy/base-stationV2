// Wake-on-demand for our self-hosted Hugging Face Space engines.
// Spaces are left to sleep/pause when idle (keeps costs down). Before a job is
// submitted, the caller awaits ensureAwake(): if the Space is running this is a
// single quick health probe; if it is asleep or paused we wake it, wait until
// /health answers, and only then let the prompt/content through.

const WAIT_MS = 150_000;
const POLL_MS = 8_000;
const warmUntil = new Map<string, number>();

async function healthy(base: string): Promise<boolean> {
  try {
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(6000) });
    const text = await res.text();
    if (!res.ok) return false;
    JSON.parse(text); // a sleeping Space answers with an HTML placeholder
    return true;
  } catch {
    return false;
  }
}

// https://owner-space-name.hf.space → owner/space-name
function spaceId(base: string): string | null {
  const m = base.match(/^https:\/\/([a-z0-9]+)-([a-z0-9-]+)\.hf\.space/i);
  return m ? `${m[1]}/${m[2]}` : null;
}

async function kick(base: string) {
  const id = spaceId(base);
  const token = Deno.env.get('HF_TOKEN');
  if (id && token) {
    const auth = { Authorization: `Bearer ${token}` };
    const rt = await fetch(`https://huggingface.co/api/spaces/${id}/runtime`, { headers: auth })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null);
    // Paused/stopped Spaces don't wake from traffic — they need an explicit restart.
    if (rt && ['PAUSED', 'STOPPED', 'RUNTIME_ERROR'].includes(rt.stage)) {
      await fetch(`https://huggingface.co/api/spaces/${id}/restart`, { method: 'POST', headers: auth }).catch(() => {});
    }
  }
  // Any request to a sleeping Space triggers its boot.
  await fetch(base, { signal: AbortSignal.timeout(10000) }).catch(() => {});
}

export async function ensureAwake(baseUrl: string): Promise<void> {
  const base = baseUrl.replace(/\/+$/, '');
  if ((warmUntil.get(base) || 0) > Date.now()) return;
  if (await healthy(base)) { warmUntil.set(base, Date.now() + 60_000); return; }

  console.log(`[hfWake] ${base} asleep — waking`);
  await kick(base);
  const deadline = Date.now() + WAIT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    if (await healthy(base)) {
      console.log(`[hfWake] ${base} awake`);
      warmUntil.set(base, Date.now() + 60_000);
      return;
    }
  }
  throw new Error('The engine was asleep and is still starting up. Please try again in a couple of minutes.');
}