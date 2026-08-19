# BASE Print — decode + extract (Cog predictor).
#
# Downloads nothing itself (Cog hands us the file), decodes ANY audio container
# via ffmpeg, and runs the BASE Print ratio-hash extraction, returning the
# packed BP01 blob plus diagnostics. The blob is a few MB at most; the decoded
# PCM (potentially hundreds of MB for long_form podcasts) never leaves this box.
#
# ── PARITY CONTRACT ─────────────────────────────────────────────────────────
# This file is a line-for-line mirror of base44/shared/basePrint.ts. Every
# constant, the box-average resampler, the Hann definition, the 3x3 peak pick,
# the parabolic interpolation clamp, the JS-style rounding (half-up, NOT
# banker's), the quantizer edges and the dither rule are all load-bearing for
# hash comparability. A print extracted here MUST be comparable with a print
# extracted by the TS path — benchmarkBasePrint's `parity` action verifies this
# after every rebuild, and no remote print is trusted until it passes.
#
# The ONE deliberate difference from the TS path: decode. ffmpeg replaces the
# runtime's WAV/FLAC readers, which is the entire reason this container exists
# (the app runtime cannot decode MP3 at all and OOMs on large FLAC). For stereo
# ffmpeg's default downmix is (L+R)/2 — identical to toMono() in the TS path.
# For >2 channels ffmpeg uses weighted coefficients where the TS path uses a
# flat average; podcast/music masters are mono/stereo so this is noted, not
# handled.
#
# What this may claim is unchanged by where it runs: a Print match is
# RESEMBLANCE, never attribution (BASE_MARK_FORENSIC_SPEC §8). Nothing here is
# a TPM. This container embeds nothing and cannot disturb any BASE Mark layer.

import math
import struct
import subprocess
import tempfile
from pathlib import Path as SysPath

import numpy as np
from cog import BasePredictor, Input, Path, BaseModel

# ── Constants — mirror basePrint.ts exactly. Change NOTHING here without a
# matching change on the TS side and a PRINT_VERSION bump (a version mismatch
# means blobs must be rebuilt, never compared). ──────────────────────────────
PRINT_VERSION = 1
PRINT_MAGIC = 0x42503031  # "BP01"
TARGET_SR = 11025
FFT_SIZE = 512
HOP_SIZE = 128
MIN_BIN = 4
MAX_BIN = 200
PEAKS_PER_SECOND = 20
FANOUT = 4
MIN_DT = 0.02
MAX_DT = 2.0
SEMITONE_STEP = 0.5
SEMITONE_RANGE = 64
FREQ_BITS = 8
TIME_RATIO_BITS = 6
DITHER_THRESHOLD = 0.25
MAX_HASHES = 400000


def js_round(x):
    # JS Math.round rounds half UP (toward +inf); Python round() is banker's.
    # The TS quantizers were written against Math.round, so the mirror must
    # reproduce it — a half-even divergence lands boundary values in different
    # buckets on the two sides, which is exactly the drift parity exists to catch.
    return math.floor(x + 0.5)


# ── Decode via ffmpeg ────────────────────────────────────────────────────────
def probe_sample_rate(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "a:0",
         "-show_entries", "stream=sample_rate", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    rate = int(out.splitlines()[0])
    if rate <= 0:
        raise ValueError("ffprobe reported a non-positive sample rate")
    return rate


def decode_mono_f32(path, max_seconds):
    # Decode at NATIVE rate, mono, float32. The resample to TARGET_SR happens in
    # resample_mono below using the same box-average as the TS path — NOT
    # ffmpeg's high-quality resampler, which would move interpolated peak
    # positions relative to references extracted by the runtime.
    src_rate = probe_sample_rate(path)
    cmd = ["ffmpeg", "-v", "error", "-i", str(path)]
    if max_seconds and max_seconds > 0:
        cmd += ["-t", str(float(max_seconds))]
    cmd += ["-vn", "-ac", "1", "-f", "f32le", "-acodec", "pcm_f32le", "pipe:1"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    samples = np.frombuffer(raw, dtype=np.float32)
    if samples.size == 0:
        raise ValueError("ffmpeg produced no audio samples")
    return samples, src_rate


# ── Mirror of resampleMono ──────────────────────────────────────────────────
# The ALGORITHM is deliberately NOT improved: it is the same crude box average
# over a fixed `width` window at non-uniform (truncated) start offsets, not a
# proper anti-aliasing filter. That crudeness is load-bearing — a better
# resampler would move interpolated peak positions relative to every reference
# already extracted by the TS path.
#
# Only the EXECUTION is vectorised. The pure-Python per-output-sample loop this
# replaces ran ~29.7M iterations for a 45-minute 44.1kHz episode, which
# dominated the whole prediction (the FFTs themselves are batched and take well
# under a second). Same arithmetic, ~100x less interpreter overhead.
#
# Accumulation is forced to float64 to match the TS side, where JS numbers are
# doubles (`sum += ...; out[i] = sum / n` accumulates in float64 and only the
# store into a Float32Array narrows). numpy's default float32 accumulator for a
# float32 input would have been a genuine, if tiny, divergence from that.
#
# Chunked because the index matrix is out_len x width — materialising it whole
# for a long episode would be hundreds of MB, which is the same memory mistake
# this container exists to avoid.
_RESAMPLE_BLOCK = 1 << 21  # ~2M output samples per block


def resample_mono(samples, src_rate, dst_rate=TARGET_SR):
    if src_rate == dst_rate:
        return samples
    ratio = src_rate / dst_rate
    out_len = int(samples.size / ratio)
    width = max(1, int(ratio))
    out = np.zeros(out_len, dtype=np.float32)
    n = samples.size

    for base in range(0, out_len, _RESAMPLE_BLOCK):
        stop = min(base + _RESAMPLE_BLOCK, out_len)
        i = np.arange(base, stop, dtype=np.int64)
        # int(i * ratio) — truncation toward zero; values are non-negative here,
        # so astype(int64) is exactly the same operation.
        starts = (i * ratio).astype(np.int64)

        # Fast path: every window lies fully inside the signal, so the whole
        # block is one gather + one row-wise mean.
        if starts[-1] + width <= n:
            idx = starts[:, None] + np.arange(width, dtype=np.int64)[None, :]
            out[base:stop] = samples[idx].astype(np.float64).mean(axis=1)
            continue

        # Tail: at least one window is clamped by the end of the signal, so the
        # window LENGTHS differ and a rectangular mean would silently average in
        # the wrong number of samples. Done element-wise — it is a handful of
        # windows, never a hot path.
        for k, s in zip(range(base, stop), starts):
            e = min(s + width, n)
            if e > s:
                out[k] = samples[s:e].astype(np.float64).mean()

    return out


# ── Mirror of extractPeaks ──────────────────────────────────────────────────
def extract_peaks(samples, sample_rate):
    mono = resample_mono(samples, sample_rate, TARGET_SR)
    n_frames = max(0, (mono.size - FFT_SIZE) // HOP_SIZE + 1)
    if n_frames < 3:
        return []

    # np.hanning(n) = 0.5 - 0.5*cos(2*pi*i/(n-1)) — same symmetric window as
    # the TS hann().
    win = np.hanning(FFT_SIZE)
    n_bins = FFT_SIZE // 2

    # Frame the signal and batch the FFTs — numerically identical to the TS
    # per-frame loop, just vectorised.
    idx = np.arange(FFT_SIZE)[None, :] + HOP_SIZE * np.arange(n_frames)[:, None]
    frames = mono[idx] * win[None, :]
    spec = np.fft.rfft(frames, n=FFT_SIZE, axis=1)[:, :n_bins]
    mags = np.log(np.abs(spec) + 1e-12).astype(np.float64)

    bin_hz = TARGET_SR / FFT_SIZE
    hi_bin = min(MAX_BIN, n_bins - 1)
    lo_bin = max(MIN_BIN, 1)

    candidates = []  # (t, f, mag)
    cur = mags[1:-1]
    prev = mags[:-2]
    nxt = mags[2:]
    # Strict local max over the 3x3 time-frequency neighbourhood, same
    # comparisons (<=) as the TS loop.
    k = np.arange(lo_bin, hi_bin)
    c = cur[:, k]
    is_peak = (
        (c > cur[:, k - 1]) & (c > cur[:, k + 1]) &
        (c > prev[:, k]) & (c > nxt[:, k])
    )
    frs, kis = np.nonzero(is_peak)
    for fr_i, k_i in zip(frs, kis):
        fr = fr_i + 1
        kk = k[k_i]
        v = mags[fr, kk]
        left = mags[fr, kk - 1]
        right = mags[fr, kk + 1]
        denom = left - 2 * v + right
        raw = (0.5 * (left - right)) / denom if denom != 0 else 0.0
        delta = max(-0.5, min(0.5, raw))
        f = (kk + delta) * bin_hz
        if f <= 0:
            continue
        candidates.append(((fr * HOP_SIZE) / TARGET_SR, f, v))

    # Rank-cull per 1s window to the target density — the density knob stays
    # untouched for speech per the calibration discipline (reported, not tuned).
    by_window = {}
    for p in candidates:
        by_window.setdefault(int(p[0]), []).append(p)
    kept = []
    for arr in by_window.values():
        arr.sort(key=lambda p: -p[2])
        kept.extend(arr[:PEAKS_PER_SECOND])
    kept.sort(key=lambda p: p[0])
    return kept


# ── Mirror of the quantizers ────────────────────────────────────────────────
def quantize_semitones_detail(ratio):
    semis = 12 * math.log2(ratio)
    clamped = max(-SEMITONE_RANGE, min(SEMITONE_RANGE, semis))
    raw = clamped / SEMITONE_STEP + js_round(SEMITONE_RANGE / SEMITONE_STEP)
    idx = js_round(raw)
    frac = raw - idx
    hi = (1 << FREQ_BITS) - 1
    clamp = lambda v: max(0, min(hi, v))
    return clamp(idx), clamp(idx + (1 if frac >= 0 else -1)), abs(frac)


def quantize_time_ratio(r):
    q = js_round(math.log2(max(1.0001, r)) * 8)
    return max(0, min((1 << TIME_RATIO_BITS) - 1, q))


# ── Mirror of hashPeaks ─────────────────────────────────────────────────────
def hash_peaks(peaks, dither=False):
    out = []
    n = len(peaks)
    for i in range(n):
        if len(out) >= MAX_HASHES:
            break
        a_t, a_f, _ = peaks[i]
        fan = []
        for j in range(i + 1, n):
            if len(fan) >= FANOUT:
                break
            dt = peaks[j][0] - a_t
            if dt < MIN_DT:
                continue
            if dt > MAX_DT:
                break
            fan.append(peaks[j])
        for x in range(len(fan)):
            for y in range(x + 1, len(fan)):
                b_t, b_f, _ = fan[x]
                c_t, c_f, _ = fan[y]
                d12 = b_t - a_t
                d13 = c_t - a_t
                if d12 <= 0 or d13 <= d12:
                    continue
                i1, n1, af1 = quantize_semitones_detail(b_f / a_f)
                i2, n2, af2 = quantize_semitones_detail(c_f / a_f)
                h3 = quantize_time_ratio(d13 / d12)
                opts1 = [i1, n1] if (dither and af1 > DITHER_THRESHOLD) else [i1]
                opts2 = [i2, n2] if (dither and af2 > DITHER_THRESHOLD) else [i2]
                for h1 in opts1:
                    for h2 in opts2:
                        h = (h1 << (FREQ_BITS + TIME_RATIO_BITS)) | (h2 << TIME_RATIO_BITS) | h3
                        out.append((h, a_t))
                        if len(out) >= MAX_HASHES:
                            return out
    return out


# ── Mirror of packPrint (big-endian, same 20-byte header) ───────────────────
def pack_print(hashes, duration_seconds):
    buf = bytearray(20 + len(hashes) * 8)
    struct.pack_into(">IIIII", buf, 0, PRINT_MAGIC, PRINT_VERSION, TARGET_SR,
                     len(hashes), js_round(duration_seconds * 1000))
    o = 20
    for h, t in hashes:
        struct.pack_into(">II", buf, o, h, js_round(t * 1000))
        o += 8
    return bytes(buf)


def duration_bracket(seconds):
    if not seconds > 0:
        return "short"
    if seconds < 120:
        return "short"
    if seconds < 1200:
        return "medium"
    if seconds <= 3600:
        return "long_form"
    return "extended"


class Output(BaseModel):
    print_blob: Path
    hash_count: int
    duration_seconds: float
    duration_bracket: str
    hashes_per_second: float
    source_sample_rate: int
    version: int


class Predictor(BasePredictor):
    def setup(self):
        pass  # no model to load — this is pure DSP

    def predict(
        self,
        audio: Path = Input(description="Audio file in any container ffmpeg reads (MP3, FLAC, WAV, M4A, OGG)"),
        dither: bool = Input(
            default=False,
            description="QUERY prints only. Emits boundary-straddling hash variants (2-4x count) to recover "
                        "warped matches. NEVER set for a stored reference — the asymmetry is deliberate.",
        ),
        max_seconds: float = Input(
            default=0,
            description="Analyse only the first N seconds (0 = whole file). Registration uses a cap; "
                        "calibration sets it explicitly so brackets stay comparable.",
        ),
    ) -> Output:
        samples, src_rate = decode_mono_f32(audio, max_seconds)
        duration = samples.size / src_rate

        peaks = extract_peaks(samples, src_rate)
        hashes = hash_peaks(peaks, dither=dither)
        if not hashes:
            # Signal 'no_landmarks' as a hard error rather than an empty blob —
            # the caller must never store a reference that can match nothing.
            raise ValueError("no_landmarks")

        blob = pack_print(hashes, duration)
        out_path = SysPath(tempfile.mkdtemp()) / "print.bp01"
        out_path.write_bytes(blob)

        return Output(
            print_blob=Path(out_path),
            hash_count=len(hashes),
            duration_seconds=round(duration, 2),
            duration_bracket=duration_bracket(duration),
            hashes_per_second=round(len(hashes) / max(1.0, duration), 1),
            source_sample_rate=src_rate,
            version=PRINT_VERSION,
        )