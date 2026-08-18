// Tier 1 foreign-provenance reader.
//
// Outside uploads carry no BASE Station telemetry, which is why they resolve to
// 'unverified'. But the FILE itself usually still names the machine and software
// that produced it: WAV broadcast-extension chunks name the originating
// workstation, ID3v2 names the encoder, MP4/FLAC/Ogg carry encoder strings.
// Reading those turns "we know nothing" into "here is what the source left in".
//
// This reads only what is declared in the container. It never infers authorship
// from the audio, and a stripped file legitimately yields nothing — absence is
// reported as absence, not as a finding.

import { assertSafeUrl } from './safeUrl.ts';

const dec = (bytes) => new TextDecoder('latin1').decode(bytes).replace(/\u0000+$/g, '').trim();

function findAscii(view, needle, from = 0) {
  const pat = [...needle].map((c) => c.charCodeAt(0));
  outer: for (let i = from; i <= view.length - pat.length; i++) {
    for (let j = 0; j < pat.length; j++) if (view[i + j] !== pat[j]) continue outer;
    return i;
  }
  return -1;
}

function detectContainer(view) {
  const head = dec(view.subarray(0, 12));
  if (head.startsWith('ID3') || (view[0] === 0xff && (view[1] & 0xe0) === 0xe0)) return 'mp3';
  if (head.startsWith('RIFF') && head.includes('WAVE')) return 'wav';
  if (head.startsWith('fLaC')) return 'flac';
  if (head.includes('ftyp')) return 'm4a';
  if (head.startsWith('OggS')) return 'ogg';
  return 'unknown';
}

// ── ID3v2: TSSE (encoder software), TENC (encoded by), TDRC (recorded) ──
function readId3(view) {
  const out = {};
  if (dec(view.subarray(0, 3)) !== 'ID3') return out;
  const size = ((view[6] & 0x7f) << 21) | ((view[7] & 0x7f) << 14) | ((view[8] & 0x7f) << 7) | (view[9] & 0x7f);
  const end = Math.min(10 + size, view.length);
  let p = 10;
  while (p + 10 <= end) {
    const id = dec(view.subarray(p, p + 4));
    const len = (view[p + 4] << 24) | (view[p + 5] << 16) | (view[p + 6] << 8) | view[p + 7];
    if (!/^[A-Z0-9]{4}$/.test(id) || len <= 0 || p + 10 + len > end) break;
    const val = dec(view.subarray(p + 11, p + 10 + len));
    if (id === 'TSSE') out.encoder_software = val;
    if (id === 'TENC') out.encoded_by = val;
    if (id === 'TDRC' || id === 'TDAT') out.origination_date = val;
    p += 10 + len;
  }
  // LAME/Xing encoder build stamp sits in the first frame's side info
  const lame = findAscii(view, 'LAME', 10);
  if (lame > -1) out.encoder_build = dec(view.subarray(lame, lame + 9));
  return out;
}

// ── WAV broadcast extension: the richest Tier 1 source ──
// bext = description(256) originator(32) originatorReference(32) date(10)
// time(8) ... then a free-text CodingHistory tail naming the software chain.
function readWavBext(view) {
  const out = {};
  const at = findAscii(view, 'bext');
  if (at > -1) {
    const size = view[at + 4] | (view[at + 5] << 8) | (view[at + 6] << 16) | (view[at + 7] << 24);
    const b = at + 8;
    const end = Math.min(b + size, view.length);
    out.machine_originator = dec(view.subarray(b + 256, b + 288)) || undefined;
    out.originator_reference = dec(view.subarray(b + 288, b + 320)) || undefined;
    const date = dec(view.subarray(b + 320, b + 330));
    const time = dec(view.subarray(b + 330, b + 338));
    if (date) out.origination_date = time ? `${date} ${time}` : date;
    if (end > b + 602) {
      const hist = dec(view.subarray(b + 602, end));
      if (hist) out.coding_history = hist.slice(0, 600);
    }
  }
  // LIST/INFO ISFT = software that wrote the file
  const isft = findAscii(view, 'ISFT');
  if (isft > -1) {
    const size = view[isft + 4] | (view[isft + 5] << 8) | (view[isft + 6] << 16) | (view[isft + 7] << 24);
    if (size > 0 && size < 512) out.encoder_software = dec(view.subarray(isft + 8, isft + 8 + size));
  }
  return out;
}

// ── FLAC / Ogg Vorbis comment: vendor string + ENCODER field ──
function readVorbisComment(view) {
  const out = {};
  for (const tag of ['ENCODER=', 'encoder=']) {
    const at = findAscii(view, tag);
    if (at > -1) {
      out.encoder_software = dec(view.subarray(at + tag.length, at + tag.length + 128)).split(/[\x00-\x08\x0e-\x1f]/)[0];
      break;
    }
  }
  const ref = findAscii(view, 'reference libFLAC');
  if (ref > -1) out.vendor_string = dec(view.subarray(ref, ref + 40)).split(/[\x00-\x08\x0e-\x1f]/)[0];
  return out;
}

// ── MP4/M4A: the "©too" (\xa9too) atom names the encoding tool ──
function readMp4Tool(view) {
  const out = {};
  const at = findAscii(view, '\u00a9too');
  if (at > -1) {
    const val = dec(view.subarray(at + 4, at + 128)).replace(/^[\x00-\x1f]*(data)?[\x00-\x1f]*/, '');
    if (val) out.encoder_software = val.split(/[\x00-\x08\x0e-\x1f]/)[0];
  }
  return out;
}

/**
 * Parse declared provenance out of raw container bytes.
 * `head` is the file's leading bytes; `tail` (optional) covers MP4 moov atoms
 * that sit at the end of the file.
 */
export function parseForeignProvenance(headBuf, tailBuf) {
  const head = new Uint8Array(headBuf);
  const container = detectContainer(head);

  let found = {};
  if (container === 'mp3') found = readId3(head);
  else if (container === 'wav') found = readWavBext(head);
  else if (container === 'flac' || container === 'ogg') found = readVorbisComment(head);
  else if (container === 'm4a') {
    found = readMp4Tool(head);
    if (!found.encoder_software && tailBuf) found = readMp4Tool(new Uint8Array(tailBuf));
  }

  // Drop empty strings so "present but blank" never reads as evidence
  const observations = {};
  for (const [k, v] of Object.entries(found)) {
    if (typeof v === 'string' && v.trim()) observations[k] = v.trim();
  }

  const signals = Object.keys(observations);
  return {
    tier: 1,
    container,
    observations,
    signal_count: signals.length,
    // The honest summary line shown to a creator
    summary: signals.length
      ? `Container metadata recovered: ${signals.join(', ')}.`
      : 'No software or workstation metadata present in this file — either stripped before upload or never written by the source tool.',
    scanned_at: new Date().toISOString(),
  };
}

// Redirects are followed manually, one hop at a time, with the destination
// re-validated — a storage URL legitimately redirects, but an unchecked
// redirect is an SSRF hole.
export async function rangeFetch(url, range) {
  let target = url;
  for (let hop = 0; hop < 3; hop++) {
    const res = await fetch(target, { headers: { Range: range }, redirect: 'manual' });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return res;
      target = assertSafeUrl(new URL(loc, target).toString());
      continue;
    }
    return res;
  }
  throw new Error('Too many redirects while reading audio');
}

/** Fetch just the header/footer bytes needed and parse them. */
export async function scanForeignProvenanceFromUrl(url) {
  const headRes = await rangeFetch(url, 'bytes=0-262143');
  if (!headRes.ok && headRes.status !== 206) throw new Error(`Could not read audio (${headRes.status})`);
  const headBuf = await headRes.arrayBuffer();

  // MP4 metadata frequently lives at the end of the file
  let tailBuf = null;
  const total = Number(headRes.headers.get('content-range')?.split('/')?.[1] || 0);
  if (total > 262144) {
    const tailRes = await rangeFetch(url, `bytes=${Math.max(0, total - 131072)}-${total - 1}`).catch(() => null);
    if (tailRes?.ok || tailRes?.status === 206) tailBuf = await tailRes.arrayBuffer();
  }

  return parseForeignProvenance(headBuf, tailBuf);
}