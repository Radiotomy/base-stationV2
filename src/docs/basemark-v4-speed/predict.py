"""
BASE Mark V4 — Speed Layer.

Fourth forensic layer, built on audiowmark (Stefan Westerfeld, GPLv3), targeting
the ONE failure mode that V1, V2 and V3 all share and that we have now measured
three separate times on real audio: re-timed playback.

── WHY THIS LAYER EXISTS ───────────────────────────────────────────────────────
Our benchmark grid, run against a real 48kHz/24-bit master, recovered NOTHING
from any layer under:

    pitch +1 semitone (resample)   V1 0%   V2 0%   V3 0%
    44.1k master played at 48k     V1 0%   V2 0%   V3 0%
    time stretch +5%               V1 0%   V2 0%   V3 0%

The first two of those are not really two attacks. Both are *speed changes* —
pitch and duration move together, because both are implemented as a resample.
That is precisely what audiowmark's --detect-speed is built to undo: it
ESTIMATES the playback ratio from the signal, re-times the audio, and then
decodes. Upstream demonstrates recovery at speed 1.049966 on material sped up
5%, where the plain detector returns nothing at all. Documented working range is
roughly 0.8x-1.25x.

This is categorically stronger than our existing deep scan, which can only try a
curated list of exact ratios and measured a sub-2-cent tolerance — good for
whole semitones and 44.1/48k mishandling, useless for a speed knob nudged by
hand. V4 searches for the ratio instead of guessing it.

The third row, pitch-preserved time stretch, is NOT a speed change: overlap-add
resynthesis genuinely destroys the carrier and no detector-side re-timing undoes
it. V4 is not expected to fix it. Scale-invariant fingerprinting is still the
honest answer there, and this container does not pretend otherwise.

UNVERIFIED until benchmarked. Every claim above is upstream's or inferred from
our own failure data. Run the same attack grid against this layer before a word
of it reaches the Trust Center — that discipline is exactly what stopped us from
shipping a V3 claim that turned out to be false.

── WHAT IT FIXES ABOUT V3'S DESIGN, INCIDENTALLY ───────────────────────────────
1. 128-bit payload. Our 32-bit registry payload FITS, whole. No 16-bit slot, no
   pointer indirection, no 65,536-asset ceiling, no slot recycling hazard. V4
   carries the same payload V1 and V2 carry, so all three resolve identically.
2. Native full-rate stereo. audiowmark marks the master as-is. No 16kHz
   band-split delta trick, no resampling ripple at the band edge, no fidelity
   argument to make.
3. CPU only. No GPU cold start, no warm pool, no idle burn.
"""

import pathlib
import re
import subprocess
import sys
import tempfile
import time
from typing import Optional

import soundfile as sf
from cog import BasePredictor, BaseModel, Input, Path

# Same cog import discipline as the V3 predictor, for the same hard-won reasons:
# `BaseModel` comes from cog (not pydantic), and `cog.Path` must stay unaliased
# in annotations or Replicate builds the audio input as `type: object` and
# rejects every URL string that gets sent to it.

PAYLOAD_HEX_CHARS = 32  # audiowmark messages are 128 bit


def _log(msg: str) -> None:
    """Unbuffered stderr so a slow run and a hung run are distinguishable."""
    print(f"[speed] {msg}", file=sys.stderr, flush=True)


class Output(BaseModel):
    detected: bool
    payload_hex: Optional[str]
    confidence: float
    speed: Optional[float]
    audio: Optional[Path]
    sample_rate: Optional[int]
    channels: Optional[int]
    note: str


def _run(cmd: list) -> subprocess.CompletedProcess:
    _log("$ " + " ".join(cmd))
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.stderr.strip():
        _log(p.stderr.strip()[:2000])
    return p


def _to_wav(src: pathlib.Path) -> pathlib.Path:
    """Normalize any container to PCM WAV.

    audiowmark reads WAV natively and MP3 via mpg123, but not FLAC/M4A/Ogg in
    every build, and our own V3 output is FLAC. Normalizing once here keeps the
    supported-input question out of the app layer entirely.
    """
    out = pathlib.Path(tempfile.mkdtemp()) / "in.wav"
    p = _run(["ffmpeg", "-y", "-i", str(src), "-c:a", "pcm_s24le", str(out)])
    if p.returncode != 0:
        raise RuntimeError(f"ffmpeg could not decode the input: {p.stderr[-500:]}")
    return out


def _key_file(key_hex: str) -> Optional[pathlib.Path]:
    """Materialize the shared secret as an audiowmark key file.

    The algorithm is public (GPLv3), so the KEY is the only thing separating our
    marks from marks anyone can read, locate or forge. It is passed in per call
    rather than baked into the image so it can be rotated without a rebuild, and
    so it never sits in a published container layer.
    """
    key_hex = (key_hex or "").strip()
    if not key_hex:
        return None
    if not re.fullmatch(r"[0-9a-fA-F]{32,64}", key_hex):
        raise ValueError("key_hex must be 32-64 hex characters")
    path = pathlib.Path(tempfile.mkdtemp()) / "bm.key"
    path.write_text(f"# BASE Mark V4 key\nkey {key_hex.lower()}\n")
    return path


# audiowmark's `get` output, as documented upstream:
#
#   pattern  0:05 0123456789abcdef0011223344556677 1.358 0.059 A
#   pattern   all 0123456789abcdef0011223344556677 1.399 0.035
#   speed 1.049966
#
# Columns after the hex message are a quality score (higher is better) and a
# bit-error estimate (lower is better) — upstream's own example shows genuine
# hits around 1.3-1.4 / 0.03-0.08 and spurious ones around 0.17-0.18 / 0.38-0.39,
# which is a wide, unambiguous separation.
#
# We parse the documented TEXT format rather than --json deliberately: the text
# layout is the one shown and exercised in upstream's README, so it is the shape
# we can actually reason about without guessing at a schema.
PATTERN_RE = re.compile(
    r"^pattern\s+(?P<at>\S+)\s+(?P<hex>[0-9a-f]{%d})\s+(?P<quality>[-\d.]+)\s+(?P<error>[-\d.]+)(?:\s+(?P<kind>\S+))?"
    % PAYLOAD_HEX_CHARS
)
SPEED_RE = re.compile(r"^speed\s+(?P<speed>[\d.]+)")


def _parse_get(stdout: str) -> dict:
    hits = []
    speed = None
    for line in stdout.splitlines():
        line = line.strip()
        m = PATTERN_RE.match(line)
        if m:
            hits.append(
                {
                    "at": m.group("at"),
                    "payload_hex": m.group("hex"),
                    "quality": float(m.group("quality")),
                    "error": float(m.group("error")),
                    "kind": (m.group("kind") or "").upper(),
                }
            )
            continue
        s = SPEED_RE.match(line)
        if s:
            speed = float(s.group("speed"))
    return {"hits": hits, "speed": speed}


def _best(hits: list) -> Optional[dict]:
    """Prefer the aggregate line, else the highest-quality individual hit.

    The `all` row is audiowmark's own combination of every block in the file, so
    it is strictly better evidence than any single block when it exists.
    """
    if not hits:
        return None
    agg = [h for h in hits if h["at"] == "all"]
    pool = agg or hits
    return max(pool, key=lambda h: h["quality"])


class Predictor(BasePredictor):
    def setup(self):
        p = _run(["audiowmark", "--version"])
        _log(f"audiowmark ready: {(p.stdout or p.stderr).strip()[:120]}")

    def run(
        self,
        audio: Path = Input(description="Audio file to mark or scan."),
        mode: str = Input(
            description="'encode' embeds the payload; 'decode' scans for one.",
            choices=["encode", "decode"],
            default="decode",
        ),
        # The default MUST be a literal. Written as `"0" * PAYLOAD_HEX_CHARS` it
        # was silently dropped from the generated schema, which then marked this
        # input REQUIRED and made every decode call fail 422 — the constant was
        # correct, but Cog could not serialize a computed default.
        payload_hex: str = Input(
            description="encode only — the 128-bit message as 32 hex chars, packed by the app.",
            default="00000000000000000000000000000000",
        ),
        key_hex: str = Input(
            description="Shared secret key (hex). Must match between encode and decode.",
            default="",
        ),
        detect_speed: bool = Input(
            description=(
                "decode only — search for and correct a playback speed change "
                "before decoding. This is the entire reason V4 exists, but it is "
                "off by default because it costs substantially more CPU and "
                "memory: run a normal scan first, escalate to this on a miss."
            ),
            default=False,
        ),
        patient: bool = Input(
            description=(
                "decode only — slower, more accurate speed search "
                "(--detect-speed-patient). Only meaningful with detect_speed."
            ),
            default=False,
        ),
    ) -> Output:
        t0 = time.time()
        wav_path = _to_wav(pathlib.Path(str(audio)))
        info = sf.info(str(wav_path))
        sr, n_ch = info.samplerate, info.channels
        _log(f"loaded {info.duration:.1f}s @ {sr}Hz / {n_ch}ch in {time.time()-t0:.1f}s")

        key = _key_file(key_hex)
        key_args = ["--key", str(key)] if key else []

        if mode == "decode":
            cmd = ["audiowmark", "get", str(wav_path)] + key_args
            if detect_speed:
                cmd.append("--detect-speed-patient" if patient else "--detect-speed")
            p = _run(cmd)
            parsed = _parse_get(p.stdout)
            best = _best(parsed["hits"])
            _log(f"scan finished in {time.time()-t0:.1f}s; {len(parsed['hits'])} pattern line(s)")

            if not best:
                return Output(
                    detected=False,
                    payload_hex=None,
                    confidence=0.0,
                    speed=parsed["speed"],
                    audio=None,
                    sample_rate=sr,
                    channels=n_ch,
                    note=(
                        "No Speed Layer payload recovered."
                        + ("" if detect_speed else " Retry with detect_speed=true if re-timing is suspected.")
                    ),
                )

            # Report audiowmark's own numbers and let the app decide. Same
            # contract as the other three layers: acceptance lives next to the
            # registry lookup, not inside the detector.
            return Output(
                detected=True,
                payload_hex=best["payload_hex"],
                confidence=float(max(0.0, min(1.0, 1.0 - best["error"]))),
                speed=parsed["speed"],
                audio=None,
                sample_rate=sr,
                channels=n_ch,
                note=(
                    f"quality {best['quality']:.3f}, bit-error {best['error']:.3f}, "
                    f"block {best['at']} {best['kind']}; {len(parsed['hits'])} pattern line(s). "
                    + (f"Corrected playback speed {parsed['speed']:.6f}. " if parsed["speed"] else "")
                    + "Confirm the payload against the registry before reporting a match."
                ),
            )

        # ── encode ──────────────────────────────────────────────────────────
        msg = (payload_hex or "").strip().lower()
        if not re.fullmatch(r"[0-9a-f]{%d}" % PAYLOAD_HEX_CHARS, msg):
            raise ValueError(f"payload_hex must be exactly {PAYLOAD_HEX_CHARS} hex characters")

        # audiowmark writes WAV ONLY — its output formats are wav, rf64,
        # wav-pipe and raw. It happily READS flac and mp3, which makes it easy
        # to assume it writes them too; handing it "marked.flac" produces a WAV
        # with a misleading extension rather than an error.
        work = pathlib.Path(tempfile.mkdtemp())
        marked_wav = work / "marked.wav"
        p = _run(["audiowmark", "add", str(wav_path), str(marked_wav), msg] + key_args)
        if p.returncode != 0 or not marked_wav.exists():
            raise RuntimeError(f"audiowmark add failed: {(p.stderr or p.stdout)[-500:]}")

        # Transcode to FLAC ourselves, same reasoning as V3: a 24-bit stereo
        # master is enormous as PCM WAV and Cog must upload it before the
        # prediction resolves, which is where V3's runs silently stalled for
        # minutes. FLAC is lossless, so the detector sees identical samples.
        # Never make this lossy — the mark would not survive.
        out_path = work / "marked.flac"
        c = _run(["ffmpeg", "-y", "-i", str(marked_wav), "-c:a", "flac", str(out_path)])
        if c.returncode != 0 or not out_path.exists():
            raise RuntimeError(f"FLAC transcode failed: {c.stderr[-500:]}")

        dt = time.time() - t0
        _log(f"wrote {out_path.stat().st_size/1e6:.1f}MB FLAC in {dt:.1f}s total")
        return Output(
            detected=True,
            payload_hex=msg,
            confidence=1.0,
            speed=None,
            audio=Path(out_path),
            sample_rate=sr,
            channels=n_ch,
            note=(
                f"Payload embedded across the full {info.duration:.1f}s at {sr}Hz / {n_ch}ch. "
                "Master not resampled, not downmixed, full bandwidth preserved."
            ),
        )