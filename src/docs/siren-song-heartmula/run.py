"""
Cog runner for the siren-song model — a fork of HeartMuLa (heartlib).

ENTRY POINT: BasePredictor.predict()
------------------------------------
This file defines `class Predictor(BasePredictor)` with a `predict()` method, and
cog.yaml points at it with `predict: "run.py:Predictor"`. This is Cog's legacy
interface and is still supported by current Cog releases.

TWO OPPOSITE FAILURES HAVE BEEN SEEN HERE — both present as a prediction stuck in
"starting" forever, because a predictor that cannot load kills every worker slot
during setup instead of failing the build:

  1. Writing `from cog import BaseRunner` against an OLD SDK:
         ImportError: cannot import name 'BaseRunner' from 'cog'
     Hence this file uses BasePredictor.

  2. Pinning `sdk_version` to an SDK OLDER than Replicate's current loader
     (2026-08-24, SDK pinned to 0.18.0):
         AttributeError: module 'cog.predictor' has no attribute 'BaseRunner'
     The loader probes for BaseRunner to detect which interface the class uses;
     the probe raises before this Predictor is reached. Nothing in THIS file
     mentions BaseRunner — the fix was to stop pinning the SDK in cog.yaml.

So: keep BasePredictor here, and do not pin sdk_version there.

WHY THE 1 ms SUCCESS HAPPENS
----------------------------
A run that reports "succeeded" in ~1 ms with `output: null` is the signature of
an entry point that never produced a value. Cog marks the run successful because
nothing raised, and returns null because nothing was returned. Two things MUST be
true, and are the usual omissions:

  1. predict() RETURNS a cog.Path pointing at a file that exists on disk.
     Writing the file is not enough. Printing the path is not enough.
  2. The model is loaded in setup(), with weights present in the image. A setup()
     that cannot find ./ckpt has nothing for predict() to execute.

A third, subtler cause: if cog.yaml points at a class that has no matching entry
method at all, the container still boots and answers instantly with nothing —
which is why the pointer in cog.yaml and the class/method here must agree
exactly ("run.py:Predictor" → class Predictor → def predict).

HEARTMULA'S CONDITIONING CONTRACT (this is NOT a prose-prompt model)
-------------------------------------------------------------------
Confirmed against src/heartlib/pipelines/music_generation.py:

  * TWO conditioning channels only — `tags` and `lyrics`. Each may be a raw
    string OR a path to a .txt file; preprocess() checks os.path.isfile() and
    reads the file if it is one. We pass strings.
  * `tags` are lowercased and auto-wrapped in <tag>…</tag> by the pipeline.
    Comma-separated tokens, no spaces: "piano,happy,wedding,synthesizer".
    This is the style channel — a prose sentence is a misuse of it.
  * `lyrics` are lowercased. Bracketed section headers ([Verse], [Chorus], …).
  * `ref_audio` raises NotImplementedError. Reference-audio conditioning does
    NOT exist in this release, whatever the marketing feature list says.

OUTPUT FORMAT
-------------
postprocess() ends with:

    torchaudio.save(save_path, wav.to(torch.float32).cpu(), 48000)

So the native output is a 48 kHz float32 tensor, and torchaudio infers the
container from the save_path EXTENSION. WAV is therefore the native, lossless
form and MP3 is a lossy re-encode of it — which is why `output_format` defaults
to wav here, per our "mark once, compress last" rule.
"""

import os
import tempfile

import torch
# BasePredictor / predict() — the legacy interface, still supported. Do not import
# BaseRunner here (see the module docstring: it fails on older SDKs, and the
# loader's own BaseRunner probe is a separate, cog.yaml-side concern).
from cog import BasePredictor, Input, Path

from heartlib import HeartMuLaGenPipeline

MODEL_PATH = "./ckpt"

# Section headers heartlib was trained on. Lyrics with no header at all tend to
# be sung as one undifferentiated block, so we ensure at least one is present.
KNOWN_SECTIONS = (
    "[intro]", "[verse]", "[prechorus]", "[pre-chorus]", "[chorus]",
    "[bridge]", "[outro]", "[hook]", "[refrain]", "[instrumental]",
)


class Predictor(BasePredictor):
    def setup(self):
        """Load HeartMuLa + HeartCodec once per container boot."""
        if not os.path.isdir(MODEL_PATH):
            raise RuntimeError(
                f"Checkpoint directory {MODEL_PATH} is missing. The weights must be "
                "baked into the image at build time (see cog.yaml) — without them "
                "setup() cannot load a model and every run returns nothing."
            )

        self.pipe = HeartMuLaGenPipeline.from_pretrained(
            MODEL_PATH,
            device={"mula": torch.device("cuda"), "codec": torch.device("cuda")},
            # bf16 for the LM, fp32 for the codec — the upstream README warns that
            # running HeartCodec in bf16 degrades audio quality.
            dtype={"mula": torch.bfloat16, "codec": torch.float32},
            version="3B",
            lazy_load=False,
        )

    def predict(
        self,
        tags: str = Input(
            description=(
                "Style tags, comma-separated with NO spaces after the commas — "
                "e.g. 'piano,happy,wedding,synthesizer,romantic'. This is the style "
                "channel; do not write a sentence here."
            ),
            default="piano,soul,warm,analog,slow",
        ),
        lyrics: str = Input(
            description=(
                "Lyrics with bracketed section headers ([Intro], [Verse], [Chorus], "
                "[Bridge], [Outro]). Use '[Instrumental]' alone for an instrumental."
            ),
            default="[Instrumental]",
        ),
        output_format: str = Input(
            description=(
                "Container for the 48kHz output. 'wav' is the model's native "
                "lossless form (32-bit float PCM); mp3/flac/ogg are encoded from it."
            ),
            choices=["wav", "mp3", "flac", "ogg"],
            default="wav",
        ),
        max_audio_length_ms: int = Input(
            description=(
                "Maximum audio length in milliseconds. Generation runs at roughly "
                "real time (RTF ~1.0), so 120000 costs about two minutes of GPU time."
            ),
            default=120_000,
            ge=10_000,
            le=240_000,
        ),
        cfg_scale: float = Input(
            description="Classifier-free guidance. Higher follows the tags more literally.",
            default=1.5,
            ge=1.0,
            le=5.0,
        ),
        temperature: float = Input(default=1.0, ge=0.1, le=2.0),
        topk: int = Input(default=50, ge=1, le=200),
        # Optional[int] rather than a bare int with default=None: the newer Cog
        # runtime rejects a non-optional annotation whose default is None.
        seed: int | None = Input(description="Leave blank for a random seed.", default=None),
    ) -> Path:
        if seed is None:
            seed = int.from_bytes(os.urandom(4), "big")
        torch.manual_seed(seed)
        print(f"Using seed: {seed}")

        # Normalise the two conditioning channels. The pipeline lowercases both
        # and wraps tags in <tag></tag> itself, so we only fix structure here.
        clean_tags = ",".join(
            t.strip() for t in tags.replace("\n", ",").split(",") if t.strip()
        )
        if not clean_tags:
            raise ValueError("At least one style tag is required.")

        clean_lyrics = lyrics.strip() or "[Instrumental]"
        if not any(s in clean_lyrics.lower() for s in KNOWN_SECTIONS):
            # No section header at all — give it one rather than letting the model
            # sing an unstructured block.
            clean_lyrics = f"[Verse]\n{clean_lyrics}"

        print(f"tags: {clean_tags}")

        # torchaudio picks the encoder from the extension, so the extension IS
        # the format switch.
        out_path = os.path.join(tempfile.mkdtemp(), f"output.{output_format}")

        with torch.no_grad():
            self.pipe(
                {"lyrics": clean_lyrics, "tags": clean_tags},
                max_audio_length_ms=max_audio_length_ms,
                save_path=out_path,
                topk=topk,
                temperature=temperature,
                cfg_scale=cfg_scale,
            )

        # Fail loudly rather than "succeeding" with a null output.
        if not os.path.exists(out_path) or os.path.getsize(out_path) == 0:
            raise RuntimeError(
                "The pipeline completed but wrote no audio to save_path. "
                "This is the failure mode that presents as a successful run with "
                "no output — treat it as an error, never as a success."
            )

        print(f"Wrote {os.path.getsize(out_path)} bytes to {out_path}")
        return Path(out_path)