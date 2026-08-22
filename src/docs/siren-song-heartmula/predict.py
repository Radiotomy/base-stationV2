"""
Cog predictor for speedwolf2000/siren-song — a fork of HeartMuLa (heartlib).

WHY THIS FILE EXISTS
--------------------
A prediction that reports "succeeded" in ~1ms with no output is the signature of
a predict() that never produced a value: Cog marks the run successful because
nothing raised, and returns null because nothing was returned. The two things
that MUST be true, and are the usual omissions:

  1. predict() RETURNS a cog.Path pointing at a file that exists on disk.
     Writing the file is not enough. Printing the path is not enough.
  2. The model is loaded in setup(), not in predict(), and the weights are
     present in the image. If setup() silently no-ops, predict() has nothing
     to run and falls straight through.

HEARTMULA'S CONDITIONING CONTRACT (this is NOT a prose-prompt model)
-------------------------------------------------------------------
heartlib's pipeline is called with a dict of TWO FILE PATHS, not prompt strings:

    pipe({"lyrics": "<path>.txt", "tags": "<path>.txt"}, ...)

  * lyrics — plain text, structured with bracketed section headers
             ([Intro], [Verse], [Prechorus], [Chorus], [Bridge], [Outro]).
  * tags   — comma-separated style tokens with NO SPACES after the commas,
             e.g. "piano,happy,wedding,synthesizer,romantic".
             This is the style channel. Sentences do not belong here.

So this predictor accepts lyrics/tags as strings for API ergonomics and writes
them to temp .txt files itself, because that is what the pipeline actually reads.
"""

import os
import subprocess
import tempfile

import torch
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
                "setup() cannot load a model and every prediction returns nothing."
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
        seed: int = Input(
            description="Leave blank for a random seed.", default=None
        ),
    ) -> Path:
        if seed is None:
            seed = int.from_bytes(os.urandom(4), "big")
        torch.manual_seed(seed)
        print(f"Using seed: {seed}")

        # Normalise the two conditioning channels, then hand the pipeline PATHS.
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

        workdir = tempfile.mkdtemp()
        tags_path = os.path.join(workdir, "tags.txt")
        lyrics_path = os.path.join(workdir, "lyrics.txt")
        out_path = os.path.join(workdir, "output.mp3")

        with open(tags_path, "w", encoding="utf-8") as f:
            f.write(clean_tags)
        with open(lyrics_path, "w", encoding="utf-8") as f:
            f.write(clean_lyrics)

        with torch.no_grad():
            self.pipe(
                {"lyrics": lyrics_path, "tags": tags_path},
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