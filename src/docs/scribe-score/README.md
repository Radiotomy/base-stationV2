---
title: Scribe
emoji: 🎼
colorFrom: yellow
colorTo: red
sdk: docker
app_port: 7860
license: apache-2.0
---

# Scribe — BASE Station score engine

Audio → lead sheet (ABC with chord symbols), MIDI, and timed key / chord / section annotations.
Built only from permissively licensed components so output is commercially usable:

| Stage | Component | Licence |
|---|---|---|
| Notes → MIDI | Spotify Basic Pitch | Apache-2.0 |
| Beats / downbeats / tempo / meter | CPJKU beat_this (`final0`) | MIT |
| Chords (170-class vocabulary) | BTC-ISMIR19 large-voca | MIT |
| Key, song sections | librosa + in-house code | ISC |
| ABC lead sheet | in-house writer | — |

Endpoints:
- `POST /transcribe` — multipart `file` or form `audio_url` (https), optional `melody_only`, `title`
- `GET /health` — per-component load state

Section labels (A, B, C…) mark repeated material; they are not verse/chorus names.
Melody is a skyline of the transcribed notes — most accurate on a vocal or lead stem.