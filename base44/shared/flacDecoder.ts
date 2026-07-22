// Pure-JS FLAC → 16-bit PCM WAV decoder for BASE Mark embedding.
// Supports mono/stereo, 8–24 bit FLAC streams (constant, verbatim, fixed and LPC
// subframes, rice/rice2 residuals, all stereo decorrelation modes).

export function isFlac(bytes) {
  return bytes.length > 4 && bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43; // "fLaC"
}

class BitReader {
  constructor(bytes, pos) {
    this.b = bytes;
    this.pos = pos;
    this.bit = 0;
  }
  readBit() {
    const v = (this.b[this.pos] >> (7 - this.bit)) & 1;
    if (++this.bit === 8) { this.bit = 0; this.pos++; }
    return v;
  }
  readBits(n) {
    let v = 0;
    while (n > 0) {
      const avail = 8 - this.bit;
      const take = n < avail ? n : avail;
      const chunk = (this.b[this.pos] >> (avail - take)) & ((1 << take) - 1);
      v = v * (2 ** take) + chunk;
      this.bit += take;
      if (this.bit === 8) { this.bit = 0; this.pos++; }
      n -= take;
    }
    return v;
  }
  readSigned(n) {
    const v = this.readBits(n);
    const half = 2 ** (n - 1);
    return v >= half ? v - 2 ** n : v;
  }
  readUnary() {
    let n = 0;
    while (this.readBit() === 0) n++;
    return n;
  }
  alignByte() {
    if (this.bit) { this.bit = 0; this.pos++; }
  }
}

function readResidual(br, blockSize, predOrder, out) {
  const method = br.readBits(2);
  if (method > 1) throw new Error('FLAC: unsupported residual coding');
  const pbits = method === 0 ? 4 : 5;
  const escape = method === 0 ? 15 : 31;
  const partOrder = br.readBits(4);
  const parts = 1 << partOrder;
  let idx = predOrder;
  for (let p = 0; p < parts; p++) {
    const count = (blockSize >> partOrder) - (p === 0 ? predOrder : 0);
    const param = br.readBits(pbits);
    if (param === escape) {
      const bits = br.readBits(5);
      for (let i = 0; i < count; i++) out[idx++] = bits === 0 ? 0 : br.readSigned(bits);
    } else {
      for (let i = 0; i < count; i++) {
        const q = br.readUnary();
        const r = param > 0 ? br.readBits(param) : 0;
        const u = q * (2 ** param) + r;
        out[idx++] = (u % 2 === 1) ? -((u + 1) / 2) : u / 2;
      }
    }
  }
}

function decodeSubframe(br, blockSize, bps) {
  if (br.readBit() !== 0) throw new Error('FLAC: bad subframe padding bit');
  const type = br.readBits(6);
  let wasted = 0;
  if (br.readBit() === 1) wasted = br.readUnary() + 1;
  const ebps = bps - wasted;
  const out = new Array(blockSize);

  if (type === 0) { // CONSTANT
    const v = br.readSigned(ebps);
    out.fill(v);
  } else if (type === 1) { // VERBATIM
    for (let i = 0; i < blockSize; i++) out[i] = br.readSigned(ebps);
  } else if (type >= 8 && type <= 12) { // FIXED, order 0-4
    const order = type - 8;
    for (let i = 0; i < order; i++) out[i] = br.readSigned(ebps);
    readResidual(br, blockSize, order, out);
    for (let i = order; i < blockSize; i++) {
      if (order === 1) out[i] += out[i - 1];
      else if (order === 2) out[i] += 2 * out[i - 1] - out[i - 2];
      else if (order === 3) out[i] += 3 * out[i - 1] - 3 * out[i - 2] + out[i - 3];
      else if (order === 4) out[i] += 4 * out[i - 1] - 6 * out[i - 2] + 4 * out[i - 3] - out[i - 4];
    }
  } else if (type >= 32) { // LPC
    const order = (type & 31) + 1;
    for (let i = 0; i < order; i++) out[i] = br.readSigned(ebps);
    const precision = br.readBits(4) + 1;
    if (precision === 16) throw new Error('FLAC: invalid LPC precision');
    const shift = br.readSigned(5);
    const coefs = new Array(order);
    for (let j = 0; j < order; j++) coefs[j] = br.readSigned(precision);
    readResidual(br, blockSize, order, out);
    const div = 2 ** shift;
    for (let i = order; i < blockSize; i++) {
      let sum = 0;
      for (let j = 0; j < order; j++) sum += coefs[j] * out[i - 1 - j];
      out[i] += Math.floor(sum / div);
    }
  } else {
    throw new Error('FLAC: reserved subframe type');
  }

  if (wasted) {
    const mul = 2 ** wasted;
    for (let i = 0; i < blockSize; i++) out[i] *= mul;
  }
  return out;
}

const BS_TABLE = [0, 192, 576, 1152, 2304, 4608, -1, -2, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768];
const SS_TABLE = [0, 8, 12, -1, 16, 20, 24, 32];

// Decode a FLAC file into a 16-bit PCM WAV (Uint8Array).
export function decodeFlacToWav(bytes) {
  if (!isFlac(bytes)) throw new Error('Not a FLAC file');
  // --- metadata blocks ---
  let pos = 4;
  let sampleRate = 0, channels = 0, bps = 0;
  while (pos + 4 <= bytes.length) {
    const last = bytes[pos] >> 7;
    const type = bytes[pos] & 0x7f;
    const len = (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3];
    if (type === 0) { // STREAMINFO
      const o = pos + 4;
      sampleRate = (bytes[o + 10] << 12) | (bytes[o + 11] << 4) | (bytes[o + 12] >> 4);
      channels = ((bytes[o + 12] >> 1) & 7) + 1;
      bps = (((bytes[o + 12] & 1) << 4) | (bytes[o + 13] >> 4)) + 1;
    }
    pos += 4 + len;
    if (last) break;
  }
  if (!sampleRate) throw new Error('FLAC: missing STREAMINFO');
  if (channels > 2) throw new Error('FLAC: only mono and stereo are supported');

  const br = new BitReader(bytes, pos);
  const chunks = [];
  let totalFrames = 0;

  while (br.pos < bytes.length - 2) {
    // frame sync (resync byte-by-byte if needed)
    if (!(bytes[br.pos] === 0xff && (bytes[br.pos + 1] & 0xfc) === 0xf8)) { br.pos++; br.bit = 0; continue; }
    br.bit = 0;
    br.readBits(16); // sync + reserved + blocking strategy
    const bsCode = br.readBits(4);
    const srCode = br.readBits(4);
    const chanAsgn = br.readBits(4);
    const ssCode = br.readBits(3);
    br.readBit(); // reserved
    // UTF-8 coded frame/sample number — consume
    const b0 = br.readBits(8);
    if (b0 & 0x80) {
      let mask = 0x40, extra = 0;
      while (b0 & mask) { extra++; mask >>= 1; }
      for (let i = 0; i < extra; i++) br.readBits(8);
    }
    let blockSize = BS_TABLE[bsCode];
    if (blockSize === -1) blockSize = br.readBits(8) + 1;
    else if (blockSize === -2) blockSize = br.readBits(16) + 1;
    else if (blockSize === 0) throw new Error('FLAC: reserved block size');
    if (srCode === 12) br.readBits(8);
    else if (srCode === 13 || srCode === 14) br.readBits(16);
    const frameBps = ssCode === 0 ? bps : SS_TABLE[ssCode];
    if (frameBps <= 0) throw new Error('FLAC: reserved sample size');
    br.readBits(8); // CRC-8

    const nCh = chanAsgn < 8 ? chanAsgn + 1 : 2;
    const sub = [];
    for (let c = 0; c < nCh; c++) {
      let cbps = frameBps;
      if ((chanAsgn === 8 && c === 1) || (chanAsgn === 9 && c === 0) || (chanAsgn === 10 && c === 1)) cbps++;
      sub.push(decodeSubframe(br, blockSize, cbps));
    }
    br.alignByte();
    br.readBits(16); // CRC-16

    // stereo decorrelation
    if (chanAsgn === 8) { // left/side
      for (let i = 0; i < blockSize; i++) sub[1][i] = sub[0][i] - sub[1][i];
    } else if (chanAsgn === 9) { // side/right
      for (let i = 0; i < blockSize; i++) { const side = sub[0][i]; sub[0][i] = sub[1][i] + side; }
    } else if (chanAsgn === 10) { // mid/side
      for (let i = 0; i < blockSize; i++) {
        const side = sub[1][i];
        const m = sub[0][i] * 2 + (side & 1);
        sub[0][i] = (m + side) / 2;
        sub[1][i] = (m - side) / 2;
      }
    }

    // interleave → 16-bit
    const shift = frameBps - 16;
    const frame = new Int16Array(blockSize * nCh);
    for (let i = 0; i < blockSize; i++) {
      for (let c = 0; c < nCh; c++) {
        let v = sub[c][i];
        if (shift > 0) v = Math.floor(v / 2 ** shift);
        else if (shift < 0) v *= 2 ** -shift;
        if (v > 32767) v = 32767; else if (v < -32768) v = -32768;
        frame[i * nCh + c] = v;
      }
    }
    chunks.push(frame);
    totalFrames += blockSize;
  }

  if (totalFrames === 0) throw new Error('FLAC: no audio frames decoded');

  // --- WAV container ---
  const dataSize = totalFrames * channels * 2;
  const wav = new Uint8Array(44 + dataSize);
  const dv = new DataView(wav.buffer);
  dv.setUint32(0, 0x52494646); dv.setUint32(4, 36 + dataSize, true); dv.setUint32(8, 0x57415645);
  dv.setUint32(12, 0x666d7420); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
  dv.setUint16(22, channels, true); dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * channels * 2, true); dv.setUint16(32, channels * 2, true);
  dv.setUint16(34, 16, true); dv.setUint32(36, 0x64617461); dv.setUint32(40, dataSize, true);
  let off = 44;
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i++) { dv.setInt16(off, chunk[i], true); off += 2; }
  }
  return wav;
}