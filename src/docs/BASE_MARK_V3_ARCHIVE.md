# BASE Mark V3 (Drift Layer) — Archive & Decommission Record

Status: **FULLY DECOMMISSIONED — all eight steps executed, nothing outstanding.**
This document is now a historical record and the rebuild path. The code, the
entity, the secrets and the Replicate deployments are gone; only the container
source under `src/docs/basemark-v3-drift/` is retained, deliberately, so the layer
can be rebuilt if re-timing leakage is ever observed in the wild.

The "Adverse effects" section below is preserved **as executed history**, not as
pending guidance — it documents the ordering constraint that made removal safe.

The Drift Layer (WavMark on Replicate) was cancelled after it failed robustness
benchmarks on real masterings and could not deliver the re-timing resilience it
existed to provide. The Replicate deployments (`basemark-drift`,
`basemark-drift-warm`) are the removable part. The CODE is a different question.

---

## 1. Adverse effects of stripping — READ FIRST

### 1.1 BLOCKER: V3 is layer 3 of the live public verifier

`base44/shared/baseMarkVerify.ts` is the unified three-layer funnel. It is NOT
V3-optional — it imports `decodeV3` and `findAssetForSlotHex` at module scope:

```
import { decodeV3 } from './baseMarkV3.ts';
import { findAssetForSlotHex } from './baseMarkV3Slots.ts';
```

That funnel is called by **`verifyBaseMark`**, which backs the **public,
no-login `/verify` page**. Deleting `baseMarkV3.ts` or `baseMarkV3Slots.ts`
without first editing `baseMarkVerify.ts` breaks the import and takes the
public verifier down entirely — including its free V1 spectral layer, which has
nothing to do with V3.

**Order is mandatory: edit `baseMarkVerify.ts` to drop layer 3 FIRST, then
delete the modules.**

### 1.2 Deleting the Replicate deployments alone is SAFE

The layer-3 call in the funnel sits inside `try { … } catch { /* best effort */ }`.
If the drift model/deployment no longer exists, the call throws and the funnel
returns the miss it would have returned anyway. No user-facing break.

Cost of leaving the code while the model is gone: every authenticated deep
verify that misses on V1+V2 makes one doomed Replicate round trip before
answering. Wasted latency, no wasted GPU (nothing to cold-start).

### 1.3 Assets already carrying a V3 mark

Any asset whose `metadata.base_mark_v3.status === 'completed'` and
`promoted === true` has the drift delta baked into its **canonical audio**.
Removing the code does not alter those files and does not affect V1/V2 recovery
on them — the layers are independent. What is lost is the ability to resolve a
drift slot back to an asset. Check for promoted rows before deciding whether
layer 3 has any remaining evidentiary value:

- `BaseMarkV3Slot` rows with `status: 'active'` = slots believed to be live in
  distributed files.
- If that count is 0, layer 3 can never produce a hit and is pure dead weight.

### 1.4 Not affected by V3 removal (verified by reading the code)

- `autoBaseMarkV2` — V1 + V2 only, no V3 import. Production marking is untouched.
- `deepScanBaseMark` — pure V1 re-timing search, no V3 import.
- `detectBaseMarkV2`, `pollBaseMarkV2`, `replicateV2Webhook`, `rescanAssetMark` —
  V2 path only.
- On-chain provenance (`registerOnBase`, `pinToIPFS`) — uses a SHA-256 of the
  audio bytes, unrelated to any watermark layer.
- COS scoring (`cosEngine.ts`) — telemetry only, no watermark dependency.

---

## 2. Archived inventory — every V3 artifact in the app

### Shared modules (`base44/shared/`)
| File | Role |
|---|---|
| `baseMarkV3.ts` | Transport: endpoints, `runV3`/`startV3`/`getV3Prediction`, `encodeV3`/`decodeV3`, `slotHex`. Model default `speedwolf2000/basemark-drift`, warm pool `speedwolf2000/basemark-drift-warm`. |
| `baseMarkV3Slots.ts` | 16-bit slot allocator: race-safe allocation, 180-day quarantine on release, `poolStats`, `findAssetForSlotHex`. |
| `baseMarkV3Finalize.ts` | Settled-prediction finalizer: three refusals (no partial promotion, no resample/downmix, slot activates only on a promoted file). |
| `baseMarkVerify.ts` | **SHARED WITH V1/V2 — do not delete.** Only its layer-3 block is V3. |
| `replicateWebhook.ts` | **SHARED — do not delete.** Provides `driftWebhookUrl()`. |

### Backend functions (`base44/functions/`)
| Function | Role |
|---|---|
| `startBaseMarkV3` | Phase 2 — allocate slot, start encode, stamp `base_mark_v3` metadata. |
| `pollBaseMarkV3` | Phase 3 — poll prediction, hand to finalizer. |
| `warmBaseMarkV3` | Warms the drift deployment pool. |
| `inspectBaseMarkV3` | Diagnostic: raw prediction inspection. |
| `testBaseMarkV3` | Bounded encode/decode test harness. |
| `baseMarkV3Slots` | Admin slot-pool API (stats, release). |
| `smokeBaseMarkCascadeV3` | Cascade smoke test proving V1+V2+V3 coexist. |

### Entity
- `base44/entities/BaseMarkV3Slot.jsonc` — the slot↔asset mapping. **Contains
  the only record of which files carry which slot. Do not delete before
  confirming `active` count is 0; export the rows first if it is not.**

### Container source (`src/docs/basemark-v3-drift/`)
- `predict.py`, `cog.yaml`, `requirements.txt` — the WavMark Cog image source.
  This is the ONLY artifact not reproducible from the app, and it is what lets
  the layer be rebuilt if re-timing leakage is ever observed in the wild.
  **Keep these regardless of what else is stripped.**

### Secrets
- `BASE_MARK_V3_MODEL`, `BASE_MARK_V3_VERSION` (and optional
  `BASE_MARK_V3_DEPLOYMENT`, never set — code falls back to the hardcoded name).

### Asset metadata key
- `UserAsset.metadata.base_mark_v3` — `{ version, engine, model, status, prediction_id, slot, slot_hex, slot_record_id, payload_hex, source_file_url, source_sample_rate, source_channels, max_seconds, promoted, marked_file_url, embedded_at }`

---

## 3. Decommission order (when you choose to proceed)

1. Export/confirm `BaseMarkV3Slot` — if any row is `active`, keep the entity.
2. Edit `baseMarkVerify.ts`: delete the two V3 imports and the layer-3 block;
   the funnel becomes spectral → neural. **This step must come first.**
3. Delete the seven V3 backend functions.
4. Delete `baseMarkV3.ts`, `baseMarkV3Slots.ts`, `baseMarkV3Finalize.ts`.
5. Remove `driftWebhookUrl` from `replicateWebhook.ts` (leave the V2 helpers).
6. Remove V3 UI affordances (BASE Mark Studio / dev smoke pages) — audit those
   files before editing; they are not covered by this document.
7. Clear the `BASE_MARK_V3_*` secrets.
8. Delete the Replicate deployments. (Safe at any point — see §1.2.)

`src/docs/basemark-v3-drift/` stays. Historic `base_mark_v3` metadata on assets
stays; it is a factual record of what was applied and costs nothing.

---

## 4. Executed

Steps 1–6 are DONE.

Pre-flight measurement taken before anything was removed: `BaseMarkV3Slot` held
**0 rows**, and **0 assets** carried `base_mark_v3` metadata in any state
(`completed` / `embedding` / `failed`). No identity was recoverable through the
drift layer at any point, so its removal cannot have cost a single lookup —
that is the fact that made this safe, not the code audit.

Removed: the layer-3 block and its imports in `baseMarkVerify.ts` (funnel is now
spectral → neural); the seven V3 backend functions; `baseMarkV3.ts`,
`baseMarkV3Slots.ts`, `baseMarkV3Finalize.ts`; the `BaseMarkV3Slot` entity;
`driftWebhookUrl` and the `?v3_asset` routing branch in `replicateV2Webhook`
(V2 embeds and generation jobs route exactly as before); and the four
`v3_*` actions in `benchmarkBaseMark`.

No V3 UI affordance existed to remove — BASE Mark Studio, the dev smoke pages
and the benchmark panels never exposed one. `RobustnessPanel` keeps its `drift`
layer label so any historic `BaseMarkBenchmark` rows still render honestly.

**Steps 7–8 are also DONE.** The `BASE_MARK_V3_VERSION` and `BASE_MARK_V3_MODEL`
secrets have been cleared, and the `basemark-drift` and `basemark-drift-warm`
Replicate deployments have been deleted. Nothing V3 remains in the app, the
secret store or the inference provider.

## 5. Post-removal verification (2026-08-11)

The two-layer funnel was re-verified end-to-end after the removal, not assumed:

- **Cascade smoke, real GPU** — spectral embedded, neural layered on top, both
  detectors re-run against the finished file: both resolved to the matching
  payload, `cascade_viable: true`.
- **Public verifier** — the cascaded file was submitted through the live
  no-login path and resolved on the free spectral layer without escalating to a
  GPU, exactly as the funnel's cost ordering intends.
- **Platform smoke suite** — 25/25 checks passing across studio tools, live
  studio, Audius, fan economy, provider router and the origin-separation gates.
- **Security probes** — SSRF guard rejected a link-local metadata host; the
  marking automation refused a forged asset id by re-deriving every gate from the
  stored record; benchmark and webhook endpoints rejected unknown actions and
  unsigned calls.

No regression was attributable to the V3 removal.

## 6. Rebuild trigger

Do **not** rebuild this layer speculatively. The rebuild trigger is a measured
one: re-timed copies of BASE Station masters observed circulating in the wild at a
rate the Print Layer cannot attribute. If that happens, the container source plus
§2's inventory is sufficient to reconstitute the layer — but note that V3 measured
0% against re-timing, so the correct response to that trigger is almost certainly
the Speed Layer or the Print Layer, not this one.