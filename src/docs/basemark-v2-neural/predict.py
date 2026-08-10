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
callers, so the entrypoint returns exactly one `Path`:

The entrypoint method is named `run`. Cog deprecated `Predictor.predict()` in
favour of `Predictor.run()`; the `predict:` key in cog.yaml is unrelated to the
method name and still points at the CLASS (`predict.py:Predictor`), so it stays
as it is. The public API on Replicate is unchanged — input and output schema are
derived from this signature either way.

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

# Seconds of 44.1kHz audio handed to the model in one call.
#
# WHY THIS EXISTS: encoding a whole track in one shot allocates a tensor
# proportional to its length. A 3-minute 48kHz master OOM'd a 14.5GB T4
# ("tried to allocate 2.84 GiB"), and the failure scales with duration — so it
# passed on short test clips and died on real tracks.
#
# 30s keeps peak allocation roughly constant regardless of track length. The
# message is embedded in FULL in every chunk (SilentCipher repeats it across
# frames anyway), so chunking does not split the payload and does not weaken
# recovery — a decoder that sees any one intact chunk recovers all 40 bits.
CHUNK_SEC = 30


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


def _subtype_for(original: pathlib.Path, decoded: pathlib.Path) -> str:
    """Write the output at the SOURCE bit depth.

    The finalizer rejects a depth change outright, so defaulting to 16-bit here
    would fail every 24-bit master. Read the depth from the ORIGINAL upload, not
    from the ffmpeg-normalized copy — that copy is always pcm_s24le, so reading
    it would silently promote every 16-bit master to 24-bit and get the mark
    discarded by the integrity guard.
    """
    for candidate in (original, decoded):
        try:
            sub = sf.info(str(candidate)).subtype
        except Exception:
            continue
        if sub in ("PCM_16", "PCM_24", "PCM_32", "FLOAT"):
            return sub
    return "PCM_24"


class Predictor(BasePredictor):
    def setup(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model = silentcipher.get_model(model_type="44.1k", device=self.device)

    def _encode_delta(self, m441: np.ndarray, msg: list) -> np.ndarray:
        """Watermark delta for the whole signal, computed CHUNK BY CHUNK.

        Returns `w441 - m441` rather than the marked signal, because the caller
        resamples the delta back to the master's rate and adds it to the
        untouched original. Each chunk is released from the GPU before the next
        is loaded, so peak VRAM tracks CHUNK_SEC, not track duration.

        A trailing chunk shorter than a second cannot carry a mark, so it
        contributes silence to the delta instead of being sent to the model —
        the master's own samples come through untouched there.
        """
        step = int(CHUNK_SEC * SC_RATE)
        parts = []
        for start in range(0, len(m441), step):
            seg = m441[start : start + step]
            if len(seg) < SC_RATE:
                parts.append(np.zeros(len(seg), dtype=np.float32))
                continue
            w, _ = self.model.encode_wav(seg, SC_RATE, msg)
            w = np.asarray(w, dtype=np.float32)
            if len(w) < len(seg):
                w = np.pad(w, (0, len(seg) - len(w)))
            parts.append(w[: len(seg)] - seg)
            if self.device == "cuda":
                torch.cuda.empty_cache()
            _log(f"chunk {start//step + 1} of {-(-len(m441)//step)} marked")
        return np.concatenate(parts) if parts else np.zeros(0, dtype=np.float32)

    def _scan_windows(self, m441: np.ndarray, phase_shift: bool):
        """Scan the signal in overlapping windows and return the best hit.

        WHY THIS EXISTS: encoding is chunked (see CHUNK_SEC), so a track longer
        than one chunk is a SEQUENCE of independently-marked segments joined at
        the seams. Handing that whole signal to `decode_wav` in one call — what
        this method replaces — fails outright: the seams break the decoder's
        frame lock and it reports nothing, even though every individual chunk
        carries a perfectly intact 40-bit message. Measured: a 70s file scanned
        whole -> not detected; its first 28s scanned alone -> exact message at
        0.89 confidence. That is why marking looked healthy on short smoke
        tests and failed on every real track.

        Windows are CHUNK_SEC long with a half-chunk hop, so at least one window
        lands inside a single encode chunk even when the file has been cropped
        and the seams no longer sit on absolute 30s boundaries. Scanning stops
        at the first strong hit, so the common case costs one window rather than
        a full sweep — and peak memory tracks the window, not the track length.
        """
        win = int(CHUNK_SEC * SC_RATE)
        hop = max(1, win // 2)
        best = None
        for start in range(0, max(1, len(m441)), hop):
            seg = m441[start : start + win]
            # A stub shorter than a few seconds cannot hold a full message.
            if len(seg) < 5 * SC_RATE:
                break
            result = self.model.decode_wav(seg, SC_RATE, phase_shift_decoding=phase_shift)
            if not result.get("status"):
                continue
            messages = result.get("messages") or []
            confidences = result.get("confidences") or []
            if not messages:
                continue
            conf = float(confidences[0]) if confidences else 0.0
            hit = {"message": messages[0], "confidence": conf, "offset_sec": round(start / SC_RATE, 2)}
            if best is None or conf > best["confidence"]:
                best = hit
            _log(f"window @{hit['offset_sec']}s -> {messages[0]} (conf {conf:.2f})")
            # Strong, unambiguous hit — no value in scanning the rest.
            if conf >= 0.8:
                break
        return best

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
        src_path = pathlib.Path(str(audio))
        wav_path = _decode_to_wav(src_path)
        x, sr = sf.read(str(wav_path), dtype="float32", always_2d=True)
        n_ch = x.shape[1]
        mono = x.mean(axis=1)
        _log(f"loaded {len(mono)/sr:.1f}s @ {sr}Hz / {n_ch}ch in {time.time()-t0:.1f}s")

        if action == "decode":
            m441 = _resample(mono, sr, SC_RATE)
            _log(f"scanning {len(m441)/SC_RATE:.1f}s on {self.device}")
            best = self._scan_windows(m441, phase_shift_decoding)
            detected = best is not None
            payload = {
                "detected": detected,
                "messages": [best["message"]] if detected else [],
                "confidences": [best["confidence"]] if detected else [],
                "sample_rate": sr,
                "channels": n_ch,
                "matched_window_sec": best["offset_sec"] if detected else None,
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
        delta441 = self._encode_delta(m441, msg)
        _log(f"model encode finished in {time.time()-t_enc:.1f}s")

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
        subtype = _subtype_for(src_path, wav_path)
        out_path = pathlib.Path(tempfile.mkdtemp()) / "marked.wav"
        sf.write(str(out_path), out, sr, format="WAV", subtype=subtype)
        _log(
            f"wrote {out_path.stat().st_size/1e6:.1f}MB WAV @ {sr}Hz / {n_ch}ch / {subtype} "
            f"in {time.time()-t0:.1f}s total"
        )
        return Path(out_path)