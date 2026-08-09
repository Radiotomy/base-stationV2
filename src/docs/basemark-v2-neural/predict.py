"""
BASE Mark V2 — Neural Layer (SilentCipher).

Second forensic layer for BASE Station. Carries the FULL 40-bit message:
1 magic byte (0xB5) + the same 32-bit registry payload V1 embeds, so both
layers resolve to the same UserAsset record.

── WHY THIS REVISION EXISTS: THE 48kHz PROBLEM ─────────────────────────────────
SilentCipher operates at 16kHz and 44.1kHz ONLY. The previous revision handed
the master to the model directly, so a 48kHz master came back at 44.1kHz. The
app's integrity guard (baseMarkV2Finalize.ts) catches that and keeps the original
master unchanged — correct, but it means 48kHz assets get NO neural layer at all.
That is not an edge case: it was 3 of 10 embeds, and 48kHz is the video-delivery
norm.

The naive fix — resample 48k -> 44.1k, embed, resample back — is wrong. It makes
the canonical master a resampled copy, which is a permanent fidelity cost on
every 48kHz file we ship.

So we do what the V3 Drift container already does for its 16kHz mono model: never
resample the master. Extract the watermark as a DELTA and add it to the untouched
original:

    mono   = downmix(x)                      # full rate
    m441   = resample(mono, sr -> 44100)
    w441   = silentcipher_encode(m441, message)
    delta  = resample(w441 - m441, 44100 -> sr)
    out    = x + delta                       # per channel

Sample rate, bit depth, channel count and full bandwidth are all preserved,
because we ADD to the original samples rather than replacing them. Bit depth
stops being a separate problem for free — there is no re-quantization of the
master, only an output write at the source subtype.

A 44.1kHz master takes the same path, and `_resample` is a no-op identity when
the rates already match, so 44.1kHz behavior is byte-comparable to the previous
revision apart from the delta round trip.

UNVERIFIED until benchmarked: recombination is mathematically lossless in the
marked band, but resampling ripple at the band edge may cost bit accuracy. The
40-bit message has a magic byte and no error correction, so a few flipped bits
is a TOTAL loss, not a degraded one. Benchmark 48kHz recovery against the
44.1kHz figure BEFORE enabling 48kHz on the production path.

── I/O CONTRACT — DO NOT CHANGE WITHOUT CHANGING THE APP ───────────────────────
The app treats the output as a SINGLE FILE URL (it reads `pred.output` as a
string, or `[0]`, or `.url`). Returning a multi-field object would break both
callers, so `run` returns exactly one `Path`:

  action="encode"  -> a PCM WAV of the marked master.
                      Input `message` is a JSON string of 5 ints, e.g. "[181,0,...]"
                      (baseMarkV2.ts packMessage). Consumed by baseMarkV2Finalize.ts.
  action="decode"  -> a JSON file: {detected, messages: [[5 ints], ...], confidences: [...]}
                      Consumed by detectBaseMarkV2.ts, which reads result.messages[0]
                      and result.confidences[0].

Encode MUST emit PCM WAV, not FLAC: the finalizer parses the returned bytes with
parseWav to compare rate/channels/bit-depth against the master, and rehosts it as
audio/wav. A FLAC body would fail that parse and skip the integrity check entirely.
(This is the opposite of the V3 container, which returns FLAC because nothing
downstream parses its header.)
"""

import json
import pathlib
import subprocess
import sys
import tempfile
import time

import numpy as np
import silentcipher
import soundfile as sf
import torch
from cog import BasePredictor, Input, Path
from scipy.signal import resample_poly

# `cog.Path` MUST be imported and used unaliased — cog identifies file
# inputs/outputs by that exact name when generating the OpenAPI schema. Aliasing
# it makes `audio` build as `type: object`, and Replicate then rejects every URL
# string with "input.audio: Invalid type. Expected: object, given: string".
# Filesystem paths are therefore module-qualified as `pathlib.Path`.

SC_RATE = 44100
MESSAGE_LEN = 5


def _log(msg: str) -> None:
    """Unbuffered stderr so Replicate's log tail shows live progress.

    Without it the container emits nothing between boot and result, which makes
    a slow run and a hung run look identical from the API.
    """
    print(f"[neural] {msg}", file=sys.stderr, flush=True)


def _decode_to_wav(src: pathlib.Path) -> pathlib.Path:
    """Normalize any input container to PCM WAV via ffmpeg."""
    out = pathlib.Path(tempfile.mkdtemp()) / "in.wav"
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(src), "-c:a", "pcm_s24le", str(out)],
        check=True,
        capture_output=True,
    )
    return out


def _resample(x: np.ndarray, src_rate: int, dst_rate: int) -> np.ndarray:
    if src_rate == dst_rate:
        return x.astype(np.float32)
    g = np.gcd(int(src_rate), int(dst_rate))
    return resample_poly(x, int(dst_rate // g), int(src_rate // g)).astype(np.float32)


def _subtype_for(path: pathlib.Path) -> str:
    """Write the output at the SOURCE bit depth.

    The finalizer rejects a depth change outright, so defaulting to 16-bit here
    would fail every 24-bit master. soundfile reports the source subtype; we
    mirror it, falling back to 24-bit (never 16) if it is something exotic.
    """
    sub = sf.info(str(path)).subtype
    return sub if sub in ("PCM_16", "PCM_24", "PCM_32", "FLOAT") else "PCM_24"


class Predictor(BasePredictor):
    def setup(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model = silentcipher.get_model(model_type="44.1k", device=self.device)

    def run(
        self,
        audio: Path = Input(description="Audio file to mark or scan."),
        action: str = Input(
            description="'encode' embeds a message; 'decode' scans for one.",
            choices=["encode", "decode"],
            default="decode",
        ),
        message: str = Input(
            description=(
                "encode only — JSON array of 5 ints 0-255, e.g. '[181,10,32,7,255]'. "
                "Byte 0 is the BASE Mark magic (0xB5); bytes 1-4 are the 32-bit "
                "registry payload."
            ),
            default="[181,0,0,0,0]",
        ),
        phase_shift_decoding: bool = Input(
            description=(
                "decode only — robust to audio CROPS (user-submitted snippets), "
                "at a significant speed cost."
            ),
            default=False,
        ),
    ) -> Path:
        t0 = time.time()
        _log(f"decoding container (action={action})")
        wav_path = _decode_to_wav(pathlib.Path(str(audio)))
        x, sr = sf.read(str(wav_path), dtype="float32", always_2d=True)
        n_ch = x.shape[1]
        mono = x.mean(axis=1)
        _log(f"loaded {len(mono)/sr:.1f}s @ {sr}Hz / {n_ch}ch in {time.time()-t0:.1f}s")

        if action == "decode":
            m441 = _resample(mono, sr, SC_RATE)
            _log(f"scanning {len(m441)/SC_RATE:.1f}s on {self.device}")
            result = self.model.decode_wav(m441, SC_RATE, phase_shift_decoding=phase_shift_decoding)
            detected = bool(result.get("status"))
            payload = {
                "detected": detected,
                "messages": result.get("messages", []) if detected else [],
                "confidences": result.get("confidences", []) if detected else [],
                "sample_rate": sr,
                "channels": n_ch,
            }
            _log(f"scan finished in {time.time()-t0:.1f}s (detected={detected})")
            out_path = pathlib.Path(tempfile.mkdtemp()) / "result.json"
            out_path.write_text(json.dumps(payload))
            return Path(out_path)

        # ── encode: band-split delta embedding, master never resampled ──
        msg = json.loads(message)
        if not isinstance(msg, list) or len(msg) != MESSAGE_LEN:
            raise ValueError(f"message must be a JSON array of {MESSAGE_LEN} ints 0-255")
        if not all(isinstance(b, int) and 0 <= b <= 255 for b in msg):
            raise ValueError("message bytes must be ints in 0-255")

        m441 = _resample(mono, sr, SC_RATE)
        _log(f"encoding {msg} over {len(m441)/SC_RATE:.1f}s on {self.device}")
        t_enc = time.time()
        w441, _ = self.model.encode_wav(m441, SC_RATE, msg)
        _log(f"model encode finished in {time.time()-t_enc:.1f}s")

        w441 = np.asarray(w441, dtype=np.float32)
        delta441 = w441 - m441[: len(w441)]
        t_rs = time.time()
        delta = _resample(delta441, SC_RATE, sr)
        _log(f"delta upsampled {SC_RATE}->{sr} in {time.time()-t_rs:.1f}s")

        # Two resampling stages can drift the length by a sample or two. Pad or
        # trim the DELTA, never the master — the master must come out
        # sample-for-sample the length it went in, or the finalizer is comparing
        # two different files.
        if len(delta) < len(mono):
            delta = np.pad(delta, (0, len(mono) - len(delta)))
        delta = delta[: len(mono)]

        out = np.clip(x + delta[:, None], -1.0, 1.0)

        # PCM WAV at the SOURCE rate, depth and channel count — the three things
        # the finalizer's integrity guard compares. Any mismatch here means the
        # mark is discarded and the master kept, which is the failure mode this
        # whole revision exists to remove.
        subtype = _subtype_for(wav_path)
        out_path = pathlib.Path(tempfile.mkdtemp()) / "marked.wav"
        sf.write(str(out_path), out, sr, format="WAV", subtype=subtype)
        _log(
            f"wrote {out_path.stat().st_size/1e6:.1f}MB WAV @ {sr}Hz / {n_ch}ch / {subtype} "
            f"in {time.time()-t0:.1f}s total"
        )
        return Path(out_path)