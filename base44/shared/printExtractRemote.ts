// BASE Print — remote decode + extract via Replicate.
//
// The app runtime cannot decode MP3 at all (verified by probe — mp3Decode.ts)
// and hits its memory ceiling on FLAC beyond roughly 20MB (verified during the
// speech calibration run: exceededMemory on a 44MB file). This module routes
// extraction to the baseprint-extract Cog container instead: the container
// decodes with ffmpeg, runs the SAME extraction (run.py is a constant-for-
// constant mirror of basePrint.ts), and returns only the packed BP01 blob —
// heavy audio never enters this runtime.
//
// PARITY DISCIPLINE: no remote print is trusted until benchmarkBasePrint's
// `parity` action shows the container and the TS path produce matching hashes
// on the same file. Rebuilding the container re-triggers that obligation.
//
// CPU only, same operational profile as V4 — no warm pool, no GPU cold start.

import { unpackPrint, PRINT_VERSION } from './basePrint.ts';

// Same defensive check as V3/V4: a stored model value without a slash is a
// misconfigured secret, and Replicate answers that with a confusing 404.
function printModel() {
  const raw = (Deno.env.get('BASE_PRINT_MODEL') || '').trim();
  return raw.includes('/') ? raw : '';
}

function printVersion() {
  return (Deno.env.get('BASE_PRINT_VERSION') || '').trim() || null;
}

// Configured means "deployed and pointed at" — an unset model must make callers
// fall back to the explicit 'non_pcm_source' coverage statement rather than
// burn a doomed Replicate call on every MP3.
export function isRemotePrintConfigured() {
  return Boolean(Deno.env.get('REPLICATE_API_TOKEN')) && Boolean(printModel() || printVersion());
}

function endpoints(version) {
  const [owner = '', name = ''] = printModel().split('/');
  const out = [];
  if (version) out.push({ url: 'https://api.replicate.com/v1/predictions', kind: 'generic' });
  if (owner && name) out.push({ url: `https://api.replicate.com/v1/models/${owner}/${name}/predictions`, kind: 'models' });
  return out;
}

async function postPrediction(input, version) {
  const token = Deno.env.get('REPLICATE_API_TOKEN');
  if (!token) throw new Error('REPLICATE_API_TOKEN is not set');
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'wait=60' };
  const list = endpoints(version);
  if (!list.length) throw new Error('BASE_PRINT_MODEL / BASE_PRINT_VERSION not configured');
  let fallback;
  for (let i = 0; i < list.length; i++) {
    const { url, kind } = list[i];
    // Only the generic endpoint accepts an explicit version digest; the models
    // endpoint rejects it outright.
    const body = kind === 'generic' ? { version, input } : { input };
    const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (r.status === 404 && i < list.length - 1) { fallback = await r.text().catch(() => ''); continue; }
    const data = await r.json();
    if (!r.ok) throw new Error(`Replicate error (${r.status}): ${data?.detail || data?.error || JSON.stringify(data)}`);
    return data;
  }
  throw new Error(`Print extraction prediction could not be created: ${fallback || 'no endpoint available'}`);
}

async function waitForPrediction(data, timeoutMs) {
  const headers = { 'Authorization': `Bearer ${Deno.env.get('REPLICATE_API_TOKEN')}` };
  const started = Date.now();
  while (data.status === 'starting' || data.status === 'processing') {
    if (Date.now() - started > timeoutMs) throw new Error('Print extraction timed out');
    await new Promise((res) => setTimeout(res, 2500));
    const p = await fetch(`https://api.replicate.com/v1/predictions/${data.id}`, { headers });
    data = await p.json();
  }
  if (data.status !== 'succeeded') throw new Error(`Print extraction failed: ${data.error || data.status}`);
  return data.output;
}

// Extract a print remotely. Returns the SAME shape as extractPrintFromUrl so
// registry callers cannot tell (and must not care) which path produced a blob —
// with `remote: true` kept for diagnostics only. Never throws: an unreachable
// container is a coverage statement, not a scan finding.
export async function extractPrintRemote(audioUrl, { dither = false, maxSeconds = 0, timeoutMs = 600000 } = {}) {
  try {
    const input = { audio: audioUrl, dither: Boolean(dither) };
    if (maxSeconds > 0) input.max_seconds = maxSeconds;
    const pred = await postPrediction(input, printVersion());
    const output = await waitForPrediction(pred, timeoutMs);

    const blobUrl = output?.print_blob;
    if (!blobUrl) throw new Error('container returned no print_blob');
    const r = await fetch(blobUrl);
    if (!r.ok) throw new Error(`blob fetch failed (${r.status})`);
    const blob = new Uint8Array(await r.arrayBuffer());

    // Sanity: the blob must parse and carry the CURRENT version — a container
    // built against different constants must be rejected here, not stored and
    // silently compared against incompatible references.
    const parsed = unpackPrint(blob);
    if (parsed.version !== PRINT_VERSION) {
      return { ok: false, reason: 'remote_version_mismatch', detail: `container v${parsed.version} vs runtime v${PRINT_VERSION}` };
    }

    return {
      ok: true,
      blob,
      hashes: parsed.hashes,
      hash_count: Number(output.hash_count) || parsed.hashes.length,
      duration_seconds: Number(output.duration_seconds) || parsed.durationSeconds,
      duration_bracket: output.duration_bracket || 'short',
      hashes_per_second: Number(output.hashes_per_second) || 0,
      sample_rate: Number(output.source_sample_rate) || 0,
      remote: true,
    };
  } catch (e) {
    return { ok: false, reason: 'remote_extract_failed', detail: e.message };
  }
}