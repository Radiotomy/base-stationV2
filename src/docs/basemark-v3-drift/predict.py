"""
BASE Mark V3 — Drift Layer.

Third forensic layer for BASE Station, built on WavMark (Chen et al., 2023).
Covers the two gaps our first two layers measurably do not:

  - Time stretching / pitch-preserved tempo change. Our spectral layer is 0%
    here and overlap-add resynthesis is not invertible, so no detection-time
    search recovers it. WavMark measured >0.8 bit-recovery accuracy on time
    stretch in the SoK survey (arXiv:2503.19176, Key Finding 2), because it
    embeds the payload repeatedly rather than keying it to a fixed length.
  - Physical re-recording at close range. Every scheme in that survey except
    WavMark and Timbre collapsed to random bits under re-record (Key Finding 6).

It does NOT rescue arbitrary pitch shift. Nothing does — Key Finding 1 puts
every one of the nine surveyed schemes below 0.6 there. Exact-ratio pitch shifts
stay the deep scan's job.

── THE FIDELITY PROBLEM, AND THE BAND-SPLIT FIX ────────────────────────────────
WavMark is a 16kHz mono model. Naively marking a master would mean shipping a
16kHz mono canonical file, which is unacceptable for a music platform.

So we never resample the master. Instead we extract the watermark as a DELTA and
add it back to the untouched original:

    mono   = downmix(x)                     # full rate
    m16    = resample(mono, sr -> 16000)
    w16    = wavmark_encode(m16, payload)
    delta  = resample(w16 - m16, 16000 -> sr)
    out    = x + delta                      # per channel

The output keeps the original sample rate, bit depth path, channel count and
full bandwidth above 8kHz. Only a low-band perturbation is added. The mark rides
in the 0-8kHz band where WavMark put it, and the detector recovers it by
downmixing and resampling back to 16kHz.

UNVERIFIED until benchmarked: recombination is mathematically lossless in the
low band, but resampling ripple at the band edge may cost bit-recovery accuracy.
Prove survival on the benchmark harness BEFORE this touches canonical audio.

── PAYLOAD CAPACITY: A HARD 16-BIT CEILING ─────────────────────────────────────
WavMark's 32-bit capacity is 16 sync-pattern bits + 16 usable payload bits. Our
V1/V2 registry payload is 32 bits, so IT DOES NOT FIT. This layer therefore
carries a 16-bit SLOT, not the registry payload — the app side must map slot ->
asset in a V3 registry table. That caps V3 at 65,536 concurrently-marked assets
and needs a slot-allocation strategy before wide rollout. V1 and V2 keep
carrying the full 32-bit payload on the same file, so this is a pointer layer.
"""

import pathlib
import subprocess
import tempfile
from typing import Optional

import numpy as np
import soundfile as sf
import torch
import wavmark
from cog import BasePredictor, Input, Path
from pydantic import BaseModel
from scipy.signal import resample_poly

# `cog.Path` MUST be imported unaliased and used unaliased in annotations. Cog
# identifies file inputs/outputs by that exact name when it generates the
# OpenAPI schema; importing it as an alias made `audio` build as a plain
# `type: object`, and Replicate then rejected every URL string with
# "input.audio: Invalid type. Expected: object, given: string". Filesystem paths
# are therefore module-qualified as `pathlib.Path` to keep the two distinct.

WM_RATE = 16000
PAYLOAD_BITS = 16


class Output(BaseModel):
    detected: bool
    payload_hex: Optional[str]
    confidence: float
    audio: Optional[Path]
    sample_rate: Optional[int]
    channels: Optional[int]
    note: str


def _decode_to_wav(src: pathlib.Path) -> pathlib.Path:
    """Normalize any input container to float-friendly PCM WAV via ffmpeg."""
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


def _hex_to_bits(payload_hex: str) -> np.ndarray:
    value = int(payload_hex, 16)
    if not 0 <= value < (1 << PAYLOAD_BITS):
        raise ValueError(f"slot must fit in {PAYLOAD_BITS} bits (0000-ffff)")
    return np.array([(value >> (PAYLOAD_BITS - 1 - i)) & 1 for i in range(PAYLOAD_BITS)], dtype=int)


def _bits_to_hex(bits) -> str:
    value = 0
    for b in bits:
        value = (value << 1) | int(b)
    return f"{value:04x}"


class Predictor(BasePredictor):
    def setup(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model = wavmark.load_model().to(self.device)

    def predict(
        self,
        audio: Path = Input(description="Audio file to mark or scan."),
        mode: str = Input(
            description="'encode' embeds a slot; 'decode' scans for one.",
            choices=["encode", "decode"],
            default="decode",
        ),
        slot_hex: str = Input(
            description="encode only — 16-bit slot as 4 hex chars, e.g. '01f4'.",
            default="0000",
        ),
    ) -> Output:
        wav_path = _decode_to_wav(pathlib.Path(str(audio)))
        x, sr = sf.read(str(wav_path), dtype="float32", always_2d=True)
        n_ch = x.shape[1]
        mono = x.mean(axis=1)

        if mode == "decode":
            m16 = _resample(mono, sr, WM_RATE)
            bits, info = wavmark.decode_watermark(self.model, m16, show_progress=False)
            if bits is None:
                return Output(
                    detected=False,
                    payload_hex=None,
                    confidence=0.0,
                    audio=None,
                    sample_rate=sr,
                    channels=n_ch,
                    note="No Drift Layer slot recovered.",
                )
            # WavMark reports one result per accepted chunk; more agreeing chunks
            # is stronger evidence. Report it rather than asserting a threshold —
            # the acceptance decision belongs to the app, next to the V3 registry
            # lookup, exactly like the other two layers.
            hits = len(info.get("results", [])) if isinstance(info, dict) else 0
            return Output(
                detected=True,
                payload_hex=_bits_to_hex(bits),
                confidence=float(min(1.0, hits / 3.0)),
                audio=None,
                sample_rate=sr,
                channels=n_ch,
                note=f"Recovered from {hits} agreeing chunk(s). Confirm slot against the V3 registry before reporting a match.",
            )

        # ── encode: band-split delta embedding, original master preserved ──
        bits = _hex_to_bits(slot_hex)
        m16 = _resample(mono, sr, WM_RATE)
        w16, _ = wavmark.encode_watermark(self.model, m16, bits, show_progress=False)

        delta16 = np.asarray(w16, dtype=np.float32) - m16[: len(w16)]
        delta = _resample(delta16, WM_RATE, sr)

        # Length can drift by a sample or two through two resampling stages; pad
        # or trim the delta rather than the master. The master must come out
        # sample-for-sample the same length it went in.
        if len(delta) < len(mono):
            delta = np.pad(delta, (0, len(mono) - len(delta)))
        delta = delta[: len(mono)]

        out = np.clip(x + delta[:, None], -1.0, 1.0)
        out_path = pathlib.Path(tempfile.mkdtemp()) / "marked.wav"
        sf.write(str(out_path), out, sr, subtype="PCM_24")

        return Output(
            detected=True,
            payload_hex=slot_hex.lower(),
            confidence=1.0,
            audio=Path(out_path),
            sample_rate=sr,
            channels=n_ch,
            note=(
                f"Slot embedded as a low-band delta. Output kept at {sr}Hz / {n_ch}ch — "
                "full bandwidth preserved, master not resampled."
            ),
        )