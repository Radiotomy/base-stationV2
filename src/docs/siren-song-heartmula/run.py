"""
Cog runner for the siren-song model — a fork of HeartMuLa (heartlib).

ENTRY POINT: BaseRunner.run()
-----------------------------
This file defines `class Runner(BaseRunner)` with a `run()` method, and cog.yaml
points at it with `run: "run.py:Runner"`.

MIND THE TWO SEPARATE THINGS — conflating them cost a wasted push:

  * The cog.yaml KEY is `run:` in current Cog. `predict:` still loads but is
    deprecated and warns on every build:
        ⚠ deprecated field "predict": use "run" instead
    (An EARLIER Cog release had no `run:` key at all — a `run:` line there was
    silently ignored, no entry point loaded, and every prediction "succeeded"
    in ~1ms with output null. Cog renamed the field since. Trust the warning
    the CLI you are running actually prints, not old notes.)
  * The PYTHON base class is BaseRunner with run(). BasePredictor with predict()
    is the deprecated path that warns on every build and push.

So `run: "run.py:Runner"` is both current and warning-free: the key names the
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
# Where the two small config files are fetched from when they are not already on
# disk at boot. Public repo, no token required.
HF_CONFIG_REPO = "HeartMuLa/HeartMuLaGen"

# Section headers heartlib was trained on. Lyrics with no header at all tend to
# be sung as one undifferentiated block, so we ensure at least one is present.
KNOWN_SECTIONS = (
    "[intro]", "[verse]", "[prechorus]", "[pre-chorus]", "[chorus]",
    "[bridge]", "[outro]", "[hook]", "[refrain]", "[instrumental]",
)


class Runner(BaseRunner):
    def setup(self):
        """Load HeartMuLa + HeartCodec once per container boot.

        NEVER RAISES. This is not defensive style, it is a cost control.
        On Replicate an exception in setup() is NOT a terminal failure: the
        worker is killed, the platform restarts it, and the prediction stays in
        "starting" and retries the boot indefinitely. It reports the error and
        keeps billing — a 2x-L40S loop that only stops when a human cancels.
        That is what turned the 2026-08-25 missing-tokenizer error into 20+
        minutes of GPU spend for a one-line, unfixable-at-runtime problem.

        So a load failure is CAPTURED here and re-raised from run() instead.
        A raise inside run() IS terminal: that prediction fails in seconds with
        the real message and nothing retries. Same diagnosis, ~0 cost.

        Do not "clean this up" by letting setup() raise again.
        """
        self.pipe = None
        self.setup_error = None
        self.cfg_dir = CONFIG_PATH
        try:
            self._load()
        except BaseException as e:
            # Broad on purpose — anything that stops the model loading must
            # become a cheap per-prediction failure, not a restart loop.
            self.setup_error = f"{type(e).__name__}: {e}"
            print(f"[setup] FAILED (deferred to run): {self.setup_error}")

    def _fetch_configs(self, names):
        """Guarantee `names` exist in a readable dir, and record it as self.cfg_dir.

        Order: a source-shipped ./ckptcfg if it happens to be in the image, else
        download from Hugging Face. The download is the reliable path and the
        local dir is only a free shortcut — do not invert this, or a forgotten
        `hf download` at push time becomes a boot failure again.

        The files are ~1MB combined and public (no HF token needed), so this adds
        a second or two to a cold boot and nothing to a warm one.
        """
        scratch = tempfile.mkdtemp(prefix="ckptcfg_")
        for f in names:
            local = os.path.join(CONFIG_PATH, f)
            if os.path.isfile(local):
                shutil.copy2(local, os.path.join(scratch, f))
                print(f"[cfg] {f} taken from {CONFIG_PATH}")
                continue
            from huggingface_hub import hf_hub_download
            got = hf_hub_download(repo_id=HF_CONFIG_REPO, filename=f)
            shutil.copy2(got, os.path.join(scratch, f))
            print(f"[cfg] {f} downloaded from {HF_CONFIG_REPO}")
        self.cfg_dir = scratch

    def _load(self):
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

        # Ensure the two small shared-config files are present in ./ckpt.
        #
        # ./ckpt is a MOUNT POINT under `cog push --separate-weights`: the weights
        # image is mounted over it at container start, shadowing anything an image
        # layer wrote to ./ckpt root. That is why builds passed their build-time
        # `test -f ./ckpt/tokenizer.json` and still died on boot with that exact
        # file missing. Anything decided at BUILD time can be invalidated before
        # boot, so the source of truth for these files is a RUNTIME fetch — see
        # _fetch_configs. A locally shipped ./ckptcfg is used first when present.
        load_path = MODEL_PATH
        missing = [
            f for f in ("tokenizer.json", "gen_config.json")
            if not os.path.isfile(os.path.join(MODEL_PATH, f))
        ]
        if missing:
            # Fetch anything still absent from Hugging Face AT BOOT.
            #
            # This is the third attempt at getting these two ~1MB files to exist
            # at runtime, and the previous two both failed for the same reason:
            # every build-time strategy depends on something that is only true at
            # BUILD time. Downloading into ./ckpt is defeated by the weights
            # image mounting over it; shipping ./ckptcfg as source is defeated by
            # the folder simply not being in the project dir at push time. Both
            # passed their build guards and were still missing at boot, because a
            # build guard cannot observe a mount that happens later.
            #
            # A runtime download has no such dependency: nothing can shadow it,
            # no push flag changes it, and no local folder has to be remembered.
            # It costs ~1-2s on a cold boot. Do NOT move this back into cog.yaml.
            self._fetch_configs(missing)
            missing = [
                f for f in missing
                if not os.path.isfile(os.path.join(MODEL_PATH, f))
            ]
        if missing:
            try:
                # Preferred: copy straight into ./ckpt.
                for f in missing:
                    shutil.copy2(os.path.join(self.cfg_dir, f), os.path.join(MODEL_PATH, f))
                print(f"[ckpt] restored {missing} from {self.cfg_dir}")
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
                        shutil.copy2(os.path.join(self.cfg_dir, f), dst)
                load_path = merged
                print(f"[ckpt] {MODEL_PATH} not writable ({e}); using merged view {merged}")

        # Device placement per the upstream README: with multiple GPUs, HeartMuLa
        # and HeartCodec go on SEPARATE devices (their multi-GPU guidance is
        # `--mula_device cuda:0 --codec_device cuda:1`); on a single GPU both
        # share cuda:0. Replicate's 2x-L40S hardware has two GPUs, so detecting
        # at runtime serves both layouts with one image. lazy_load stays False:
        # upstream recommends it only as a single-GPU OOM workaround, and an
        # L40S (48GB) fits the 3B bf16 LM + fp32 codec comfortably — lazy
        # loading would just reload modules on every run.
        codec_device = torch.device("cuda:1" if torch.cuda.device_count() > 1 else "cuda:0")
        print(f"[setup] GPUs visible: {torch.cuda.device_count()} — mula on cuda:0, codec on {codec_device}")

        self.pipe = HeartMuLaGenPipeline.from_pretrained(
            load_path,
            device={"mula": torch.device("cuda:0"), "codec": codec_device},
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
        # Surface a boot failure as a TERMINAL prediction error. See setup().
        if self.setup_error is not None or self.pipe is None:
            raise RuntimeError(
                f"Model failed to load at container boot: {self.setup_error}. "
                "This is an IMAGE problem — retrying this prediction cannot fix "
                "it, so the run is failed immediately rather than looping."
            )

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