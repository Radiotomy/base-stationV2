# BASE Foundry — module reference (internal engineering)

> **CLASSIFICATION: INTERNAL ENGINEERING.** Contains no forensic parameters,
> payload formats or COS weights. Safe to read alongside the public docs, but not
> a user-facing document.

**Current as of:** 2026-08-20 (Phase 8 shipped).

The Foundry is the platform's DSP **tool-building** module: a node graph, a Web
Audio engine, a design-participation scorer, and a social layer. It is
deliberately isolated from the forensic and mastering stacks.

---

## 1. Non-negotiable isolation rules

1. **A patch is a tool, not a recording.** `FoundryPlugin` never joins the
   `UserAsset` provenance chain, never receives a BASE Mark, and never appears in
   an attribution path. A patch's `human_score` is a **design** score and must
   never be blended with, or written into, an audio COS.
2. **The engine owns its own `AudioContext`** (`src/lib/foundry/audioEngine.js`).
   It imports nothing from the mastering chain, the BASE Mark path or any COS
   module, and no code path in it can write to an asset.
3. **Insert mode never talks to `ctx.destination`.** `adopt()` runs the graph
   inside a host chain (live preview, offline render) using the host's input and
   output terminals only — an insert that also reached the speakers would double
   the signal and leak Foundry audio into renders it wasn't routed into.
4. **Namespace separation stands.** No file under `src/lib/foundry/` or
   `src/components/foundry/` may import from the forensic / mastering pipelines,
   and those pipelines reach the Foundry only through the explicit insert-slot
   boundary (`src/lib/foundry/foundryInsert.js`).

## 2. Files

| Path | Responsibility |
| --- | --- |
| `src/lib/foundry/audioEngine.js` | Web Audio engine: unit factory, graph build/swap, live params, modulation taps, `compileGraph()` |
| `src/lib/foundry/nodeTypes.js` | Node definitions, parameter ranges, starter graph |
| `src/lib/foundry/foundryScore.js` | Design participation scorer |
| `src/lib/foundry/foundryInsert.js` | Insert boundary for host chains |
| `src/lib/foundry/voiceChainRender.js` | Non-destructive Voice Chain render for ORVO |
| `src/lib/foundry/referenceProfile.js` | Client-side tonal profiling of a reference track |
| `src/lib/foundry/forkLineage.js` | Resolves a patch's ancestry (parent id, root title, fork depth) |
| `src/hooks/useFoundryEngine.js` | Workspace engine lifecycle |
| `src/hooks/usePatchModulation.js` | Silent modulation-source runner (Phase 8) |
| `src/components/foundry/*` | Canvas, palette, parameter panel, preview, cards, community hub, collections |
| `src/components/visualizer/PatchModulationTap.jsx` | Visualizer-side modulation picker + meters |
| `base44/functions/foundryGenerateGraph/entry.ts` | Prompt → graph (the only server-side piece) |

Everything else runs client-side: the Foundry costs no credits.

## 3. Engine invariants

- **Rewire is a crossfade, not a gap.** `build()` constructs the new subgraph
  before disposing the previous one; parameter changes go through `AudioParam`
  ramps rather than teardown.
- **`setParam` returns false** when a parameter changes topology (a buffer, a
  URL, a noise colour). The caller must rebuild — a `rebuildOn` parameter set in
  place would silently do nothing.
- **An invalid wire is ignored, never fatal.** Edge connection is wrapped; a
  dangling `toParam` drops the wire instead of taking the graph down.
- **An offline context is never resumed.** `ensureContext()` detects
  `startRendering` and skips `resume()`, because resuming an `OfflineAudioContext`
  *starts its render*.

## 4. Modulation taps (Phase 8)

`getModulation()` exposes each modulator's live value for consumers outside the
audio path — currently Visualizer Studio.

- Taps are **analysers hung off a modulator's output**, i.e. observers. They add
  no node to the signal path, so reading them cannot alter the audio.
- Only units flagged `isMod` (LFO, ADSR) are tapped. Taps are rebuilt with the
  graph; `modTaps` is cleared at the top of `build()`.
- A modulator's raw output is in the unit of whatever it drives (Hz, dB,
  seconds), so absolute values are meaningless to a consumer. Each tap
  **normalises against the largest magnitude it has seen** and reports `0..1`.
  Do not replace this with a fixed range — the range is patch-dependent.
- `usePatchModulation` runs the chosen patch through a **muted** engine
  (`setBypass(true)`) purely as a control source, and pulses
  `triggerEnvelopes()` / `releaseEnvelopes()` on the beat, because an ADSR rests
  at zero and would otherwise read as a dead source. The visualizer's own audio
  graph is untouched.

## 5. Social layer

| Concern | Rule |
| --- | --- |
| Forking | Copies the graph with fresh node/edge ids and increments the parent's `fork_count`. A fork does **not** inherit the parent's design score. |
| Lineage | Displayed, never suppressed. `forkLineage.js` caps traversal depth so a cyclic pointer can't hang the UI. |
| Collections | `FoundryCollection` stores `plugin_ids` only. Unresolvable ids are skipped on render, never pruned — a deleted patch must not silently rewrite someone's shelf. |
| Patch challenges | `ChallengeSubmission.plugin_id` references the live patch; `plugin_human_score` is **snapshotted at submission** so continued editing can't change what was judged. `challenge_category: 'patch_design'` carries no `track_url`. |
| Showcase | Public patches only, everywhere (community hub, most-forked shelf, artist profile). Private patches are work in progress. |

## 6. Known gaps

- `aiMastering` remains a stub; Foundry insert logic and metadata snapshots must
  be hardened before it is re-enabled.
- Collections have no reorder/edit UI yet — create and browse only.
- The Visualizer modulation tap drives the **preview** canvas (CSS transform /
  filter). It is not baked into a server-rendered visualizer file.