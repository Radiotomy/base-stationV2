# Null-Corpus Status — BASE Mark V4 False-Positive Measurement

**Last updated:** 2026-08-07
**Purpose:** running state of the false-positive (null) corpus, so work can resume without re-deriving context.

---

## Where we stand

**152 null scans. 0 false positives. 0 spurious pattern lines.**

Every scan is unmarked audio, ≥60s, speed search forced ON (`--detect-speed`), which is the
path most likely to hallucinate a pattern line. A detection on any of these rows would be a
failure; none occurred.

| `source_class` | Scans | False positives | Status |
|---|---:|---:|---|
| `ai_generated_codec` | 27 | 0 | Primary class — how we actually deliver |
| `ai_generated_wav` | 22 | 0 | Marking-stage class |
| `human_lossy_preview` | 4 | 0 | Confounded (codec + human) — cannot be quoted as a human figure |
| `human_lossless` | **95** | 0 | **Rate bounded under 3.2%; acoustic + spoken-word gaps now covered. 93 at `codec: none`, 2 at `mp3_128`.** |
| `unknown` (legacy) | 4 | 0 | Pre-dates `source_class`; excluded from per-class reporting |

## The one open cell

`human_lossless` is the class a published false-positive rate needs, and it is **not filled**:

- **n=95 bounds the rate at roughly 3.2%** (rule of three, 95% confidence); n=100 puts it just
  under 3%, which is within reach of one more short ingest. The class spans metal, hard rock,
  hip-hop, commercially mastered pop, funk/R&B, jazz-inflected arrangements, synth-heavy dance
  production, acoustic country/bluegrass, and — with the audio-Bible ingest — **spoken word: a
  single unaccompanied narrator, near-silent room tone between phrases, no music bed at all.**
  That is the sparsest signal a speed-search decoder will ever be handed, and it produced no
  pattern line on any of 17 tracks. The quiet-material gap the class has carried since the start
  is now substantially closed; what remains is **classical and ambient** (being sourced).
  Dense loud material is the easy case for a null scan; low-level audio is where a speed-search
  decoder is most likely to hallucinate a pattern line.
- **`RangerSong` (2007, owned outright) clears the licensing problem but not the fidelity one.**
  Composed by the platform owner, uploaded directly, no attribution obligation — which is exactly
  what a headline number needs. But the filename marks it as a ScreamTracker 3 (`.s3m`) module
  render: human-*composed*, sample-based tracker synthesis, not a mic-recorded or CD-mastered
  acoustic performance. A legitimate `human_lossless` row that does not on its own close the
  "modern digital master" representativeness gap.
- **Neither of the two files is CC0.** From `pdx-cs-sound/wavs`:
  - `collectathon.wav` — "Collectathon — Opening Theme" by Tovatronica — **CC-BY, attribution required**
  - `hindrance-of-a-fish.wav` — by Aidan Akenson — listed upstream only as **"CC 4.0"**, variant
    unspecified; treated as attribution-required
  The repo's blanket "CC-0 unless otherwise indicated" does not cover these two — they are the two
  *otherwise indicated*. Both rows carry their license and required attribution in `notes`.
  This conflicts with our CC0-only rule for external benchmark material: fine for internal
  measurement, **needs a decision before either appears in a report.**

### Scanned so far in this class

| File | Provenance | License | Fidelity |
|---|---|---|---|
| `collectathon.wav` | Tovatronica, via pdx-cs-sound | CC-BY — attribution required | Human-produced music |
| `hindrance-of-a-fish.wav` | Aidan Akenson, via pdx-cs-sound | "CC 4.0", variant unspecified | Human-performed song |
| `01_756-RangerSong_s3m.wav` | Platform owner, 2007 | **Owned outright** | `.s3m` tracker render, not an acoustic master |
| `AudioTrack01–04` (CD rips, batch 1) | Platform owner's CD rips, 2026-08-04 | Owned rips, no metadata | **16-bit/44.1kHz stereo CD masters — the acoustic profile the class needed.** Mix of metal/rock/pop/hip-hop. Run `null-cdrip-2026-08-04`; all 4 scanned clean (no pattern line at all). |
| `AudioTrack05–07` (CD rips, batch 2) | Platform owner's CD rips, 2026-08-04 | Owned rips, no metadata | Rock / hair metal. Same run id, all 3 clean. Batch 2's Track01/Track04 were held back pending duplicate confirmation vs batch 1 (byte sizes within 8 bytes of batch-1 tracks of the same number); Track08 rejected by the 60s gate (4.2s). |
| Commercial pop album, 11 tracks | Platform owner's CD rip, 2026-08-05 | Owned rip, no metadata | **16-bit/44.1kHz stereo CD masters, 165–329s each — commercially mastered pop, a genre the class did not previously cover.** Run `null-abba-2026-08-05`; all 11 scanned clean (no pattern line at all). |
| Mötley Crüe compilation, 19 tracks | Platform owner's CD rip, 2026-08-06 | Owned rip | **16-bit/44.1kHz stereo CD masters — commercially mastered hard rock / glam metal spanning 1981–2005 production eras, incl. one power ballad (Home Sweet Home) and one remix.** Run `null-crue-2026-08-06`; all 19 scanned clean (no pattern line at all). |
| Prince album, 12 tracks | Platform owner's CD rip, 2026-08-06 | Owned rip | **16-bit/44.1kHz stereo CD masters — funk / R&B / jazz-inflected, incl. sparser and lower-density arrangements than the rock material.** Run `null-prince-2026-08-06`; all 12 scanned clean (no pattern line at all). |
| Electropop album (2008), 14 tracks | Platform owner's CD rip, 2026-08-06 | Owned rip | **16-bit/44.1kHz stereo CD masters — heavily synth/loop-based dance-pop production, incl. a few piano-led and ballad-leaning cuts. Different production DNA from the rock/funk material: dense electronic, loudness-war era.** Run `null-gaga-2026-08-06`; all 14 scanned clean (no pattern line at all). |
| Audio Bible (Zondervan NT, Matthew), 17 tracks | Platform owner's CD rip, 2026-08-06 | Owned rip | **16-bit/44.1kHz stereo — SPOKEN WORD: one unaccompanied narrator, no music bed, long near-silent gaps between phrases. The lowest-density, lowest-energy material in the corpus by a wide margin and the strongest available test of the hallucination case. Run `null-bible-2026-08-06`; all 17 scanned clean (no pattern line at all). An 18th track (disc conclusion, 24.57s) was rejected by the 60s gate rather than scanned short.** |
| Country/bluegrass album, 10 tracks | Platform owner's CD rip, 2026-08-06 | Owned rip | **16-bit/44.1kHz stereo CD masters — ACOUSTIC: fiddle, banjo, dobro and close-mic'd vocal harmony, incl. sparse ballads and an acoustic cover. The quietest, least dense material in the corpus so far and the first real test of the low-level case where a speed-search decoder is most likely to hallucinate.** Run `null-dixie-2026-08-06`; all 10 scanned clean (no pattern line at all). |

## Lossy re-scan of the human class — UNBLOCKED going forward (2026-08-07)

The human class is measured almost entirely at `codec: "none"`, which is the rarest delivery case.
Re-scanning the SAME audio through a real encoder is the cheapest way to fill the cell that
actually governs the production gate — no new sourcing required, the container's ffmpeg does the
round trip.

**Two tracks re-scanned at `mp3_128` (run `null-dixie-mp3128-2026-08-06`): both clean, no pattern
line.** Encouraging but n=2.

**The `source_url` column has landed (2026-08-07).** `BaseMarkBenchmark` now stores the source URL
on every new row, and the scan pipeline records it automatically — so every row written from here
on is re-scannable at any codec without re-uploading. The 152 historical rows pre-date the column
(0 carry a URL); those batches remain unaddressable and would need re-upload to re-scan. The
ingest recipe from here on: scan lossless + `mp3_128` + `aac_128` in the same pass while the
upload URLs are live.

## Next step (agreed)

Professional CD-ripped WAVs, held on a separate drive, **being uploaded by the user now** — the first
4 of ~10 are ingested (see table above); more are coming and go through the identical recipe below.
These are the preferred path because:

- Lossless PCM, human-performed, modern digital masters — the acoustic profile the platform
  actually scans, which the 78rpm/Archive.org route explicitly does not provide.
- Owned outright: no attribution string attached to the headline number.

More of the owner's own 2007-era WAVs are welcome and will be scanned the same way, but they are
tracker renders — they raise n in the class without addressing the acoustic-master gap. The CD rips
are what address it.

To scan them once uploaded: **use the admin benchmark dashboard (Admin → BASE Mark Benchmarks →
Run tests)**, which dispatches, persists and polls batches — parameters, prediction ids and
gate-rejected sources are all recorded in `BaseMarkRun`, so a run survives the browser tab and a
published figure traces back to the batch that produced it. The underlying call, for reference:

```
smokeBaseMarkV4  action: "null_scan"
  sources:      [{ url, seconds }]   // seconds required — the 60s gate is enforced pre-scan
  source_class: "human_lossless"
  codec:        "none"
  seconds:      60
  batch_size:   2                    // serial-ish; concurrency crashes the decode worker
```
then poll `action: "null_poll"` with the returned `jobs` and a `run_id` until `pending: 0`
(rows are only written once the whole batch resolves).

## Standing constraints (do not relitigate)

- **Run scans serially / small batches.** Concurrent decoding crashes the worker on memory pressure.
- **60s minimum, enforced pre-scan.** Shorter audio is an easier scan and would bias the null rate
  toward clean.
- **Report FPR per class and per codec, never blended.** Codec damage consumes the detector's
  decision margin, so lossy delivery is both the common case and the likeliest source of a
  spurious hit.
- **Rows written before 2026-08-07 do not store a source URL.** The `source_url` column now exists
  and is populated automatically on every new row; historical provenance lives in `notes` and
  creation order within a batch.

## Blocker this unblocks

Per `BASE_MARK_FORENSIC_SPEC.md` §11: until the null rate is characterized per class, the
0.45–0.50 bit-error acceptance gate is uncalibrated, and a V4 recovery is measurement rather than
evidence. V4 stays admin-only, unpublished, and off the production path until then.