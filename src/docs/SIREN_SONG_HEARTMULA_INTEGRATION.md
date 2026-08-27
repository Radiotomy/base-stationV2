# siren-song (HeartMuLa) — model findings & integration contract

Research notes for `speedwolf2000/siren-song`, a fork of
[`HeartMuLa/heartlib`](https://github.com/HeartMuLa/heartlib) via
[`Radiotomy/heartlib`](https://github.com/Radiotomy/heartlib).
Sources: the fork's own README and `examples/run_music_generation.py`, the
upstream repo, and heartmula.net. Written 2026-08-22.

---

## 1. Why the prediction "succeeded" in 1ms with no output

`Radiotomy/heartlib` **contains no `cog.yaml` and no `predict.py`.** Its tree is
`assets/`, `examples/`, `src/heartlib/`, `.gitignore`, `LICENSE`, `README.md`,
`pyproject.toml` — nothing Cog-facing. So whatever was pushed to Replicate got
its predictor from somewhere else, and a run that finishes in ~1ms and reports
success with a null output is the classic shape of a predictor that never
produced a value:

- Cog reports **succeeded** because nothing raised.
- The output is **null** because `predict()` returned nothing.
- It takes **~1ms** because no model was loaded and no audio was generated — a
  real HeartMuLa run cannot finish that fast (see §3).

**Confirmed on 2026-08-23** against the live prediction: `status: succeeded`,
`predict_time: 0.0011s`, `logs: ""`, `output: null`, `total_time: 121s`. The
container booted and setup ran, then the entry point returned instantly with
nothing — the pushed build's predictor is a stub. Our pipeline correctly rejected
it ("Siren Song returned no audio output") rather than saving a phantom track.

The fix is in `src/docs/siren-song-heartmula/`: the entry point returns a
`cog.Path`, weights are baked in at build time, and a completed pipeline call
that produced no file raises instead of passing silently.

### `predict()` is deprecated — this build uses `run()`

Cog has renamed the entry point. `BaseRunner.run()` + `run: "run.py:Runner"` is
canonical; `BasePredictor` / `Predictor` / `predict()` and the `predict:` key
still execute for existing models but are **deprecated** — Cog warns on them and
`cog doctor --fix` migrates them. Two related traps in the newer runtime:

- `def run(x: str = Input(default=None))` is rejected — a `None` default needs an
  optional annotation (`str | None`). Our `seed` input follows this.
- **`pip install -e .` cannot go in `build.run`** — Cog does not mount the project
  source into build commands, so it silently installs nothing (a fine way to get a
  container that boots and generates no audio). heartlib is installed from a
  pinned git reference in `requirements.txt` instead.

> I could not open `replicate.com/speedwolf2000/siren-song` — it 404s for me, so
> it is private or under a different owner slug. I have therefore diagnosed this
> from the repo and the symptom, not from your actual pushed predictor. If your
> predictor differs from the one here, compare it against §2 first.

## 2. The conditioning contract — this is NOT a prose-prompt model

This is the part that makes siren-song unlike every other generator in BASE
Station, and it must be respected end to end.

`examples/run_music_generation.py` calls:

```python
pipe = HeartMuLaGenPipeline.from_pretrained(
    model_path,
    device={"mula": ..., "codec": ...},
    dtype={"mula": torch.bfloat16, "codec": torch.float32},
    version="3B", lazy_load=False,
)
pipe({"lyrics": lyrics_path, "tags": tags_path},
     max_audio_length_ms=..., save_path=..., topk=..., temperature=..., cfg_scale=...)
```

Two things follow:

1. **`lyrics` and `tags` accept either a raw string or a `.txt` path.**
   `preprocess()` does `if os.path.isfile(x): read(x)`, so strings work directly —
   the example script only uses files because it is a CLI. The pipeline also
   lowercases both channels and auto-wraps tags in `<tag>…</tag>`, so we must not
   add those markers ourselves.
2. **There are exactly two conditioning channels, and neither is a prose prompt:**

   | Channel | Format | Example |
   |---|---|---|
   | `tags` | comma-separated tokens, **no spaces after commas** | `piano,happy,wedding,synthesizer,romantic` |
   | `lyrics` | plain text with bracketed section headers | `[Intro]` / `[Verse]` / `[Prechorus]` / `[Chorus]` / `[Bridge]` / `[Outro]` |

   Upstream points at [issue #17](https://github.com/HeartMuLa/heartlib/issues/17)
   for tag vocabulary. A descriptive sentence in the tags channel is a
   misuse of the interface, not a soft preference.

**Consequence for BASE Station:** our existing studios send one natural-language
caption (`prompt`). That input shape does not fit this model. A siren-song
integration needs a translation step that turns a caption into (a) a tag list
and (b) section-tagged lyrics — which is exactly what the 243 Masters engine and
`aceStepLyrics` already do for Harmonix, so that machinery is reusable rather
than new. **Do not wire siren-song to the raw `prompt` field.**

### Sampling parameters (upstream defaults)

| Param | Default | Notes |
|---|---|---|
| `max_audio_length_ms` | 120000 in the pipeline, 240000 in the CLI | ceiling, not a target |
| `topk` | 50 | |
| `temperature` | 1.0 | |
| `cfg_scale` | 1.5 | higher = follows tags more literally |
| `version` | `3B` | `7B` is **not released** |

## 3. Marketing claims that the repo does not support

heartmula.net and the repo disagree, and the repo is the one we have to build
against. Flagging these so no BASE Station copy repeats a claim we cannot honour:

- **"Fast — 10-30 seconds"**: the README states inference runs at **RTF ≈ 1.0**,
  i.e. roughly one second of compute per second of audio, with acceleration and
  streaming still on the TODO list. Budget a 2-minute track at ~2 minutes of GPU
  time plus model load — not 10-30s. This has direct cost and UX consequences.
- **"Reference Audio Support" / "Upload reference tracks"**: not merely a TODO —
  `preprocess()` contains `raise NotImplementedError("ref_audio is not supported yet.")`.
  The released 3B pipeline takes lyrics and tags only. We must not ship a
  reference-audio input for this model.
- **"Commercial use, no copyright concerns"**: the code and weights are Apache
  2.0, which is a licence on the *model*, not a warranty about *outputs*. Per our
  standing evidence-not-ownership posture, this should not become an ownership
  claim in any creator-facing copy.

Accurate and safe to state: open weights, Apache 2.0, 3B params, HeartCodec at
12.5Hz, multilingual lyrics (EN/ZH/JA/KO/ES), self-hostable.

## 4. Output formats — WAV is native, and this is good news with one catch

Resolved by reading `postprocess()`:

```python
torchaudio.save(save_path, wav.to(torch.float32).cpu(), 48000)
```

The model's native output is a **48 kHz float32** tensor, and `torchaudio.save`
selects the encoder from the **file extension**. So:

| `output_format` | What you get |
|---|---|
| `wav` | native, lossless 32-bit float PCM @ 48 kHz — **our default** |
| `flac` | lossless compressed |
| `mp3` / `ogg` | lossy re-encode of the same audio (needs ffmpeg, present in the image) |

MP3 was never the model's format — it was just the example script's `save_path`.
Requesting `.wav` costs nothing in quality and is strictly better for us: a PCM
source means the **full BASE Mark cascade can run, including the V1 spectral
stage** that we skip for MP3-only providers like ElevenLabs. This is exactly the
"mark once, compress last" arrangement we already prefer.

**The catch — 48 kHz.** Two of our open issues bite precisely here: *"BASE Mark V2
detection currently failing on 48kHz masters"* and *"48kHz sampling rate support
via current delta recombination results in message corruption; requires
band-limiting delta in container before upsampling."* siren-song emits 48 kHz
natively, so its WAVs land straight in the failing regime. Before any siren-song
audio enters the cascade we should either resample to 44.1 kHz on ingest or fix
the 48 kHz path — otherwise we will be marking tracks whose marks we cannot
recover, which is worse than not marking them.

Also note `torchaudio` writes **32-bit float** WAV for a float tensor. Some DAWs
and our own tooling prefer 24-bit PCM; converting on ingest is cheap, and the
pipeline gives us no bit-depth argument to do it upstream.

## 5. Build & deploy pipeline (2026-08-27)

Builds no longer run on local Docker. The model repo has a GitHub Actions
workflow (`.github/workflows/replicate.yml`) triggered on every push to `main`:
the runner clears disk space, downloads the weights, builds the Cog container,
and pushes the new version straight to `speedwolf2000/siren-song` on Replicate.

Operational notes:

- **Local Docker builds are retired.** All the local-disk/proxy push failures
  in the history (Docker Desktop 40GB layer drops, VM disk exhaustion) are
  moot — do not revisit them.
- **Every merge to `main` produces a NEW Replicate version id.** BASE Station
  pins the version via the `SIREN_SONG_VERSION` secret, so after a push that is
  meant to go live, the secret must be updated to the new version id. A CI push
  alone does not change what the app calls.
- The source of truth for `run.py` / `cog.yaml` / `requirements.txt` is the
  model's GitHub repo; the copies in this folder are reference documentation
  and should be kept in sync when the contract changes.

## 6. Status

- [x] Corrected Cog runner + config authored (`run.py` / `cog.yaml` / `requirements.txt`)
- [x] Migrated off the deprecated `predict()` interface to `BaseRunner.run()`
- [ ] Rebuild & push the model, then repoint the pinned version secret
- [ ] Verify a real prediction returns audio on Replicate
- [x] Output formats resolved — wav/flac/mp3/ogg by extension, 48 kHz native (§4)
- [ ] Decide the 48 kHz ingest policy (resample to 44.1k vs fix the V2 48k path)
- [ ] Caption → (tags, section-lyrics) translation layer
- [ ] `generateMusicSirenSong` backend function + studio UI

The last two are deliberately not built yet: wiring a studio to a model version
that has never returned audio would mean debugging two unknowns at once.