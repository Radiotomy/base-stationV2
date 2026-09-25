---
title: SheetSage2
emoji: 🎼
colorFrom: yellow
colorTo: red
sdk: docker
app_port: 7860
license: cc-by-nc-4.0
---

BASE Station's SheetSage2 engine: audio → lead sheet (ABC), MIDI and timed
key / chord / structure annotations. Runs m-a-p/SheetSage2 (CC-BY-NC-4.0 —
non-commercial use only).

- `POST /transcribe` — multipart `file` or form `audio_url`, optional `melody_only`
  → `{ abc, events, midi (base64), summary }`
- `GET /health` — engine and model load state