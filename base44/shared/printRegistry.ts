// TRADE SECRET — BASE Station proprietary and confidential. Server-side only.
// Do not copy, publish, redistribute or import into client code.
// BASE Print — registry storage and lookup.
//
// The Print Layer embeds nothing, so unlike every Mark Layer it needs a stored
// REFERENCE to compare against. This module is the only place that writes or
// reads those references, so extraction parameters can never drift between the
// build path and the match path — a divergence there would silently compare
// ratios extracted under different constants and report a clean miss on audio
// that matches perfectly.
//
// WHAT A STORED PRINT IS NOT
// It is not a watermark, not a payload, and not attribution. A Print hit says
// "this strongly RESEMBLES asset X". Only a spectral recovery seeded by the
// Print's warp factor, confirmed against the asset registry, may ever be
// described as a BASE Mark attribution (BASE_MARK_FORENSIC_SPEC §8).

import { computePrint, packPrint, unpackPrint, PRINT_VERSION } from './basePrint.ts';
import { decodeWav } from './audioAttacks.ts';
import { isFlac, decodeFlacToWav } from './flacDecoder.ts';
import { toMono } from './audioBenchUtils.ts';
import { assertSafeUrl } from './safeUrl.ts';
import { extractPrintRemote, isRemotePrintConfigured } from './printExtractRemote.ts';

// The runtime's own decoders died with exceededMemory on a 44MB FLAC during the
// speech calibration run — files above this go straight to the remote container
// (when deployed) instead of gambling the whole request on a worker OOM, which
// is not catchable and takes the caller down with it.
const LOCAL_DECODE_BYTE_CEILING = 24 * 1024 * 1024;

// Podcasts live in long_form / extended. The original Print measurement was
// n=6 at 20 seconds, so nothing is yet known about how the lift statistic
// behaves over a 45-minute dialogue — which is exactly why the bracket is
// stored and reported rather than pooled away.
export function durationBracket(seconds) {
  if (!(seconds > 0)) return 'short';
  if (seconds < 120) return 'short';
  if (seconds < 1200) return 'medium';
  if (seconds <= 3600) return 'long_form';
  return 'extended';
}

// Server-side MP3 decoding is NOT available in this runtime — verified by probe,
// not assumed (see mp3Decode.ts). So Print extraction covers PCM WAV and FLAC
// only, and an MP3 source is reported as an explicit, named limitation instead
// of a silent miss. That distinction matters: "we could not read this container"
// and "this audio does not match" are completely different findings, and
// collapsing them would let a coverage gap masquerade as a clean result.
export function decodeForPrint(bytes) {
  let b = bytes;
  if (isFlac(b)) b = decodeFlacToWav(b);
  return decodeWav(b);
}

// Extract a print from audio at a URL. Returns the packed blob plus the
// diagnostics the calibration run needs. Never throws for an unreadable
// container — the caller gets a reason code.
export async function extractPrintFromUrl(url, { maxSeconds = 0 } = {}) {
  const safe = assertSafeUrl(url);
  const r = await fetch(safe);
  if (!r.ok) return { ok: false, reason: `fetch_failed_${r.status}` };

  // Route large files to the remote container BEFORE buffering — a local OOM is
  // an uncatchable worker death, not an error we could recover from below.
  const size = Number(r.headers.get('content-length') || 0);
  if (size > LOCAL_DECODE_BYTE_CEILING && isRemotePrintConfigured()) {
    await r.body?.cancel().catch(() => {});
    return await extractPrintRemote(safe, { maxSeconds });
  }

  const bytes = new Uint8Array(await r.arrayBuffer());
  let audio;
  try {
    audio = decodeForPrint(bytes);
  } catch (e) {
    // Container the runtime cannot read (MP3, M4A, OGG) — the remote extractor
    // exists precisely for this. Only when it too is unavailable does the scan
    // abstain with the explicit coverage statement.
    if (isRemotePrintConfigured()) {
      return await extractPrintRemote(safe, { maxSeconds });
    }
    return { ok: false, reason: 'non_pcm_source', detail: e.message };
  }

  let channels = audio.channels;
  if (maxSeconds > 0) {
    const want = Math.floor(maxSeconds * audio.sampleRate);
    if (channels[0].length > want) channels = channels.map((c) => c.slice(0, want));
  }
  const trimmed = { sampleRate: audio.sampleRate, channels };
  const durationSeconds = trimmed.channels[0].length / trimmed.sampleRate;

  // References are stored UNDITHERED. Dithering is a query-side device: it
  // emits boundary-straddling hash variants to recover warped matches, and
  // paying that 2-4x cost once on a query in memory is cheap, while paying it
  // on every stored blob would inflate the registry permanently. A match only
  // needs the two sides to meet in one bucket, so the asymmetry is safe.
  const hashes = computePrint(toMono(trimmed), trimmed.sampleRate, false);
  if (!hashes.length) return { ok: false, reason: 'no_landmarks' };

  return {
    ok: true,
    blob: packPrint(hashes, durationSeconds),
    hash_count: hashes.length,
    duration_seconds: durationSeconds,
    duration_bracket: durationBracket(durationSeconds),
    hashes_per_second: Number((hashes.length / Math.max(1, durationSeconds)).toFixed(1)),
    sample_rate: trimmed.sampleRate,
  };
}

// Build a query print (dithered) from URL — used by the seeded scan.
export async function extractQueryPrint(url, { maxSeconds = 0 } = {}) {
  const safe = assertSafeUrl(url);
  const r = await fetch(safe);
  if (!r.ok) return { ok: false, reason: `fetch_failed_${r.status}` };
  const bytes = new Uint8Array(await r.arrayBuffer());
  let audio;
  try {
    audio = decodeForPrint(bytes);
  } catch (e) {
    return { ok: false, reason: 'non_pcm_source', detail: e.message };
  }
  let channels = audio.channels;
  if (maxSeconds > 0) {
    const want = Math.floor(maxSeconds * audio.sampleRate);
    if (channels[0].length > want) channels = channels.map((c) => c.slice(0, want));
  }
  const trimmed = { sampleRate: audio.sampleRate, channels };
  const hashes = computePrint(toMono(trimmed), trimmed.sampleRate, true);
  if (!hashes.length) return { ok: false, reason: 'no_landmarks' };
  return { ok: true, hashes, audio: trimmed };
}

// Persist a print blob and its row. Idempotent per asset+version: rebuilding
// replaces the row rather than accumulating duplicates, because two prints of
// the same asset at the same version are the same claim and a matcher walking
// both would double-count its own evidence.
export async function storePrint(base44, meta, extract) {
  const file = new File([extract.blob], `baseprint-${meta.asset_id}.bin`, {
    type: 'application/octet-stream',
  });
  const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });

  const row = {
    asset_id: meta.asset_id,
    episode_id: meta.episode_id || '',
    user_id: meta.user_id || '',
    title: meta.title || '',
    file_url,
    version: PRINT_VERSION,
    hash_count: extract.hash_count,
    duration_seconds: extract.duration_seconds,
    duration_bracket: extract.duration_bracket,
    hashes_per_second: extract.hashes_per_second,
    content_class: meta.content_class || 'unknown',
    source_url: meta.source_url || '',
  };

  const existing = await base44.asServiceRole.entities.AudioFingerprint
    .filter({ asset_id: meta.asset_id, version: PRINT_VERSION })
    .catch(() => []);
  if (existing?.length) {
    return await base44.asServiceRole.entities.AudioFingerprint.update(existing[0].id, row);
  }
  return await base44.asServiceRole.entities.AudioFingerprint.create(row);
}

// Load reference prints for matching. Only rows at the CURRENT version are
// returned: comparing across versions would compare ratios extracted under
// different constants, which is not a weaker comparison but a meaningless one.
export async function loadReferencePrints(base44, { contentClass, limit = 40, excludeAssetId } = {}) {
  const query = { version: PRINT_VERSION };
  if (contentClass) query.content_class = contentClass;
  const rows = await base44.asServiceRole.entities.AudioFingerprint
    .filter(query, '-created_date', limit)
    .catch(() => []);

  const out = [];
  for (const row of rows || []) {
    if (excludeAssetId && row.asset_id === excludeAssetId) continue;
    try {
      const r = await fetch(row.file_url);
      if (!r.ok) continue;
      const parsed = unpackPrint(new Uint8Array(await r.arrayBuffer()));
      out.push({ id: row.asset_id, row, hashes: parsed.hashes });
    } catch { /* a single unreadable blob must not fail the whole scan */ }
  }
  return out;
}