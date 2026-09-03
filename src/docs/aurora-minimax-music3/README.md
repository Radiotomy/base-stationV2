# Aurora — BASE Station's MiniMax-Music3 engine

Aurora is our self-hosted deployment of
[`MiniMaxAI/MiniMax-Music3`](https://huggingface.co/MiniMaxAI/MiniMax-Music3),
running on our own Hugging Face Space (`Radiotomy/Aurora`, L40S / A10G class GPU).

**It is NOT the MiniMax family reachable through the Tempolor API.** That path
stays on `provider: 'tempcolor'` and is a third-party hosted service with its own
contract, pricing and output format. Aurora is `provider: 'aurora'`. The two are
deliberately separate rows so a provenance record can say which one made a track.

## Licence obligations — these are conditions, not preferences

The model is under the **MiniMax-Music3 COMMUNITY LICENSE**:

| Clause | Obligation | Where it is satisfied |
|---|---|---|
| 3.1 | **"MiniMax-Music3" must be prominently displayed on the UI** of a commercial product using the model | `src/components/music/aurora/MiniMaxAttribution.jsx`, rendered at the top of the studio tab **and** on every result card. Also recorded per-asset in `metadata.model_attribution`. |
| 3.2 | Separate written authorisation required **above USD 20M** aggregate yearly revenue (contact `api@minimax.io`) | Not yet applicable. Revisit before crossing the threshold. |
| 4 | Maintained, tested safeguards against infringing / AUP-violating outputs | `screenAuroraRequest()` in `base44/shared/auroraEngine.ts` (pre-GPU screen), plus the existing COS scoring and BASE Mark cascade on every output. |
| 2 | Comply with the Acceptable Use Policy (Exhibit A) | Same screen; the AUP categories are encoded there. |

Weights may be redistributed under the licence but **we do not resell them** and
must not expose a weights-download route from the Space.

Upstream lineage to keep in any attribution: MiniMax-Music3 is fine-tuned from
Qwen3-8B (Apache-2.0); DiT-2B derives from Stable Audio tools (MIT); the VAE
derives from Descript Audio Codec (MIT).

## What the model actually offers

- 8B Global LLM (long-range structure) + 0.6B Local LLM (frame-level acoustics)
  → hidden-state fusion → Flow Matching (2.4B) → Flow-VAE decoder (123M).
- **Native full songs up to 300s** with stable theme, vocal identity and
  arrangement progression.
- **32 kHz, 16-bit stereo WAV** output — real PCM, so an Aurora master enters the
  BASE Mark V1 spectral layer with no transcode.
- Two conditioning channels: `lyrics` (with section tags read as written) and a
  music description, ideally as the three-block **Structured Caption**.
- Frame budget: `max_new_tokens` at **25 frames per second**.
- Seed-reproducible.

## Engine contract

Identical in shape to Coda / Siren Song / Skye, so it inherits the persistence
work rather than reinventing it:

```
POST /generate        { prompt, lyrics, duration, max_new_tokens, seed } → { task_id, status }
GET  /status/{id}     → { status, progress, result_url?, filename? }
GET  /outputs/{file}  → the rendered WAV
GET  /engine/health   → { state_dir, state_persistent, output_dir, output_persistent }
```

Job records and rendered audio live on the persistent `/data` mount, so a Space
restart mid-render does not silently lose a job. A `404` from `/status` is treated
as a terminal `lost` state, never as a transient error.

## Space setup

1. Create the Space `Radiotomy/Aurora` — Docker SDK, GPU **L40S or A10G** (24GB+),
   sleep-on-idle enabled.
2. Attach a **persistent Storage bucket** in Space Settings → Storage (the
   `small` 20GB tier is enough — it mounts at `/data` and holds job records and
   rendered audio only; the model cache deliberately stays on the container disk
   so the bucket doesn't have to be sized for ~22GB of weights). This cannot be
   set through the API — it must be done in Settings. Without it,
   `/engine/health` reports `state_persistent: false` and restarts lose jobs.
3. Upload `app.py`, `requirements.txt`, `Dockerfile` from this folder.
4. Verify: `GET /engine/health` → `state_persistent: true`, `model_loaded: true`.
5. Submit a 60s instrumental from Music Studio → Aurora and confirm real audio
   lands in the library. BASE Station rejects silent or truncated renders, so a
   track appearing at all means the render is genuine.

## Cost

18 credits per render — above Skye's 14, because Aurora runs an 8B LLM plus a
2.4B flow stack on a larger GPU tier over a 300s window.