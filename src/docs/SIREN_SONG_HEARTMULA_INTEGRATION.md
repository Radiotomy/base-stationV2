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

The fix is in `src/docs/siren-song-heartmula/`: `predict()` returns a
`cog.Path`, weights are baked in at build time, and a completed pipeline call
that produced no file raises instead of passing silently.

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

1. **The pipeline is handed FILE PATHS, not strings.** `{"lyrics": ..., "tags": ...}`
   are paths to `.txt` files on disk. Passing prompt text directly will not work.
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
| `max_audio_length_ms` | 240000 | ceiling, not a target |
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
- **"Reference Audio Support" / "Upload reference tracks"**: reference-audio
  conditioning is an **unchecked TODO** in the README. The released 3B pipeline
  takes lyrics and tags only. We must not ship a reference-audio input for this
  model.
- **"Commercial use, no copyright concerns"**: the code and weights are Apache
  2.0, which is a licence on the *model*, not a warranty about *outputs*. Per our
  standing evidence-not-ownership posture, this should not become an ownership
  claim in any creator-facing copy.

Accurate and safe to state: open weights, Apache 2.0, 3B params, HeartCodec at
12.5Hz, multilingual lyrics (EN/ZH/JA/KO/ES), self-hostable.

## 4. Forensic pipeline note

The example pipeline writes **`.mp3`** (`save_path=./assets/output.mp3`), and the
predictor here keeps that default. Under our "mark once, compress last" rule an
MP3-only source means the V1 spectral watermark stage is skipped and we lean on
V2/V3 — the same constraint already documented for ElevenLabs. Whether
`save_path` with a `.wav` suffix yields PCM is **untested**; I have not claimed
it in the predictor. Confirming that is worth doing before siren-song output
enters the BASE Mark cascade, because a PCM source would let the full cascade run.

## 5. Status

- [x] Corrected Cog predictor + config authored (`src/docs/siren-song-heartmula/`)
- [ ] Verify a real prediction returns audio on Replicate
- [ ] Confirm whether a `.wav` `save_path` gives PCM (see §4)
- [ ] Caption → (tags, section-lyrics) translation layer
- [ ] `generateMusicSirenSong` backend function + studio UI

The last two are deliberately not built yet: wiring a studio to a model version
that has never returned audio would mean debugging two unknowns at once.