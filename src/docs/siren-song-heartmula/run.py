"""
Cog runner for the siren-song model — a fork of HeartMuLa (heartlib).

ENTRY POINT: BaseRunner.run()
-----------------------------
This file defines `class Runner(BaseRunner)` with a `run()` method, and cog.yaml
points at it with `predict: "run.py:Runner"`.

MIND THE TWO SEPARATE THINGS — conflating them cost a wasted push:

  * The cog.yaml KEY is `predict:`. There is no `run:` key. Cog's config struct
    accepts only build/image/model/predict/train/concurrency/observability/
    environment/weights, so a `run:` line is silently unrecognized, no entry
    point is loaded, and every prediction "succeeds" in ~1ms with output null.
  * The PYTHON base class is BaseRunner with run(). BasePredictor with predict()
    is the deprecated path that warns on every build and push.

So `predict: "run.py:Runner"` is both current and warning-free: the key names the
entry-point object, and the class decides which method the loader calls.

HISTORY — do not "restore" the old interface on the strength of either of these:

  1. Writing `from cog import BaseRunner` against an OLD SDK once failed with
         ImportError: cannot import name 'BaseRunner' from 'cog'
     That was an SDK too old to HAVE BaseRunner, not evidence against it.

  2. Pinning `sdk_version` to that same old SDK (0.18.0) later failed with
         AttributeError: module 'cog.predictor' has no attribute 'BaseRunner'
     because Cog's loader probes for BaseRunner to detect the interface.

Both had ONE cause: an SDK older than the runtime. cog.yaml therefore pins no
sdk_version, the latest SDK is installed, BaseRunner exists, and both the errors
above and the deprecation warning are gone together. Note both failures presented
as a run stuck in "starting" forever, because a predictor that cannot load kills
every worker slot during setup instead of failing the build.

WHY THE 1 ms SUCCESS HAPPENS
----------------------------
A run that reports "succeeded" in ~1 ms with `output: null` is the signature of
an entry point that never produced a value. Cog marks the run successful because
nothing raised, and returns null because nothing was returned. Two things MUST be
true, and are the usual omissions:

  1. run() RETURNS a cog.Path pointing at a file that exists on disk.
     Writing the file is not enough. Printing the path is not enough.
     2. The model is loaded in setup(), with weights present in the image. A setup()
     that cannot find ./ckpt has nothing for run() to execute.

     A third, subtler cause: if cog.yaml points at a class that has no matching entry
     method at all, the container still boots and answers instantly with nothing —
     which is why the pointer in cog.yaml and the class/method here must agree
     exactly ("run.py:Runner" → class Runner → def run).

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
import shutil
import tempfile

import torch
# BaseRunner / run() — the current interface. Requires an unpinned (latest) SDK;
# see the module docstring before changing this back to BasePredictor.
from cog import BaseRunner, Input, Path

from heartlib import HeartMuLaGenPipeline

MODEL_PATH = "./ckpt"
# Small shared-config files live here, OUTSIDE the ./ckpt weights mount, and are
# copied into MODEL_PATH by setup(). See the note there before changing this.
CONFIG_PATH = "./ckptcfg"

# Section headers heartlib was trained on. Lyrics with no header at all tend to
# be sung as one undifferentiated block, so we ensure at least one is present.
KNOWN_SECTIONS = (
    "[intro]", "[verse]", "[prechorus]", "[pre-chorus]", "[chorus]",
    "[bridge]", "[outro]", "[hook]", "[refrain]", "[instrumental]",
)


class Runner(BaseRunner):
    def setup(self):
        """Load HeartMuLa + HeartCodec once per container boot."""
        if not os.path.isdir(MODEL_PATH):
            raise RuntimeError(
                f"Checkpoint directory {MODEL_PATH} is missing. The weights must be "
                "baked into the image at build time (see cog.yaml) — without them "
                "setup() cannot load a model and every run returns nothing."
            )

        # Dump the ACTUAL tree before handing off to the pipeline. A setup that
        # dies on a missing checkpoint file bills the full instance-up time
        # (~500s per dead slot), so one boot must produce enough evidence to fix
        # the layout — never a bare FileNotFoundError that costs another boot to
        # diagnose. This is exactly how the 2026-08-25 missing tokenizer.json
        # ate GPU minutes for no output.
        for root, dirs, files in os.walk(MODEL_PATH):
            depth = root[len(MODEL_PATH):].count(os.sep)
            if depth > 1:
                dirs[:] = []
                continue
            print(f"[ckpt] {root}: dirs={sorted(dirs)} files={sorted(files)}")

        # Restore the two small shared-config files into ./ckpt.
        #
        # They are baked into ./ckptcfg at build time and copied here at boot
        # because ./ckpt is a MOUNT POINT under `cog push --separate-weights`:
        # the weights image is mounted over it at container start, shadowing
        # anything an image layer wrote to ./ckpt root. That is why the
        # 2026-08-25 build passed its build-time `test -f ./ckpt/tokenizer.json`
        # and still died on boot with that exact file missing. Do not "simplify"
        # this away by downloading into ./ckpt in cog.yaml again — that has been
        # tried, and a mount always wins.
        load_path = MODEL_PATH
        missing = [
            f for f in ("tokenizer.json", "gen_config.json")
            if not os.path.isfile(os.path.join(MODEL_PATH, f))
        ]
        if missing:
            for f in missing:
                if not os.path.isfile(os.path.join(CONFIG_PATH, f)):
                    raise RuntimeError(
                        f"{f} is in neither {MODEL_PATH} nor {CONFIG_PATH}. "
                        f"The build stages it into {CONFIG_PATH} (see cog.yaml) — if "
                        "it is absent there, the image was built before that change. "
                        "Do not retry the prediction; rebuild."
                    )
            try:
                # Preferred: copy straight into ./ckpt.
                for f in missing:
                    shutil.copy2(os.path.join(CONFIG_PATH, f), os.path.join(MODEL_PATH, f))
                print(f"[ckpt] restored {missing} from {CONFIG_PATH}")
            except OSError as e:
                # The weights mount may be READ-ONLY — never assume it is
                # writable. Assemble a merged view in a scratch dir instead:
                # symlinks to everything in ./ckpt plus copies of the two config
                # files. Reads through symlinks are transparent to the pipeline.
                merged = tempfile.mkdtemp(prefix="ckpt_run_")
                for entry in os.listdir(MODEL_PATH):
                    os.symlink(
                        os.path.abspath(os.path.join(MODEL_PATH, entry)),
                        os.path.join(merged, entry),
                    )
                for f in ("tokenizer.json", "gen_config.json"):
                    dst = os.path.join(merged, f)
                    if not os.path.exists(dst):
                        shutil.copy2(os.path.join(CONFIG_PATH, f), dst)
                load_path = merged
                print(f"[ckpt] {MODEL_PATH} not writable ({e}); using merged view {merged}")

        self.pipe = HeartMuLaGenPipeline.from_pretrained(
            load_path,
            device={"mula": torch.device("cuda"), "codec": torch.device("cuda")},
            # bf16 for the LM, fp32 for the codec — the upstream README warns that
            # running HeartCodec in bf16 degrades audio quality.
            dtype={"mula": torch.bfloat16, "codec": torch.float32},
            version="3B",
            lazy_load=False,
        )

    def run(
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