# Audius Integration & Blockchain Depth — Roadmap

Status of every Audius surface in BASE Station, and the staged plan for the rest.
Ordered by value, following the three-tier depth recommendation.

---

## Tier 1 — Keep as-is (no work required)

The Base calldata-anchor model is already at the right depth and should NOT be
re-engineered into NFTs unless transferability becomes a product requirement.

- `BaseTrackRegistry` + `shared/chainAnchor.ts` — SHA-256 audio fingerprint, IPFS
  metadata pin, 0-value self-transaction carrying `BSTN1|<fingerprint>|<metadataUri>`.
- Correction anchoring (`BSTN1C` + `supersedes:`) handles the one real failure mode:
  an anchor cannot be edited, so a bad one is superseded by a new one that names it.
- Platform wallet pays and signs, so **creators never need a wallet**. This is a
  feature, not a limitation — it is why anchoring has near-100% adoption potential.
- Opt-in automatic anchoring (`autoAnchorAsset` + workflow), because an anchor is an
  irreversible public statement and must never be made on a creator's behalf unasked.

**Verdict: cheap, honest, irreversible-safe. Leave it alone.**

---

## Tier 2 — Audius ↔ chain bridge ✅ IMPLEMENTED

**The problem it solved:** publishing to Audius and anchoring on Base were two
*independent* provenance acts that did not reference each other. Two siloed records,
neither able to prove the other.

**The design — order matters, and the difference is recorded rather than hidden:**

| Order | Where the link lives | Strength |
|---|---|---|
| publish → anchor | Inside the signed calldata as `audius:<id>` | **Provable on-chain** (`audius_link_basis: in_calldata`) |
| anchor → publish | Off-chain row on `BaseTrackRegistry` | Our database asserting the pairing (`audius_link_basis: off_chain_backlink`) |

Calldata is immutable, so an anchor-first release can never be upgraded to the
stronger claim. A back-link is therefore **never silently relabelled** — the weaker
claim stays labelled as the weaker claim. Conflating the two would overstate what
the chain actually proves.

**What shipped:**
- `shared/audiusChainBridge.ts` — the off-chain back-link, non-fatal by design (a
  successful publish is never reported as a failure because a cross-reference failed),
  and refuses to overwrite an existing link.
- `shared/chainAnchor.ts` — appends `|audius:<id>` as an extra pipe-delimited field so
  readers that only understand `BSTN1` keep parsing correctly. Read from the record,
  not re-passed per call site.
- `BaseTrackRegistry` — `audius_track_id`, `audius_permalink`, `audius_link_basis`.
- `shared/audiusPublishPayload.ts` — the release footer now names the Base anchor tx
  and a BaseScan verify URL, plus a `base-anchored` tag. A listener who never visits
  BASE Station can verify the recording against a public chain record.
- Both publish paths (`publishToAudius`, `audiusPublishFinalize`) write the back-link.
- `registerOnBase` admin retry reproduces the full field set instead of a narrower anchor.

### Remaining Tier 2 polish (small, high value)
1. ✅ **UI surface** — `components/blockchain/AudiusChainBridgeRow.jsx`, shown on
   `ProofRegistrationCard` (Proof of Ownership) and `ProvenancePanel`. It renders the
   two link strengths differently *in words*, not just colour, and defaults to the
   WEAKER claim when the basis is unknown — never overstate what the chain proves.
   `ProvenancePanel` reads the anchor row rather than the asset, because only the
   registry row knows how the link was made.
2. **Backfill** — a one-off pass linking already-published + already-anchored assets
   (back-link basis only; their calldata cannot change). *Deliberately deferred.*
3. **`getCosManifest`** — include the anchor tx + Audius id so the exported manifest
   carries the bridge.

---

## Tier 3 — Optional, in recommended build order

Each of these is genuinely valuable but adds real complexity. Ordered so the cheapest
wins come first.

### 3a. Complete Audius publishing (no new infra)
- ✅ **`publishMetadata`** — IMPLEMENTED. `shared/audiusUpdate.ts` + the
  `refreshAudiusMetadata` function, surfaced as "Refresh provenance" on live rows in
  the Distribution sync queue. Three things are load-bearing:
  1. **Read-merge-write.** Audius' update REPLACES metadata, so the live record is
     fetched first and corrections are laid over it. Sending only changed fields
     would blank a title or artwork the creator edited on Audius itself.
  2. **Ownership is verified against the live track**, not our database — a stored
     `audius_track_id` can be stale, and an edit must never land on a stranger's
     release. (Confirmed working: a mismatched id was refused by handle.)
  3. **The footer is composed server-side** from the stored asset via
     `shared/audiusCompliance.ts` (extracted from `audiusPublishPayload.ts` so a
     correction restates the same claim a fresh publish would make, rather than
     composing a second one). A creator cannot talk their release into a better
     disclosure than their records support.
  A no-op is reported as `unchanged`, not as a failure — matching values are the
  desired end state. Asset records `audius_declared_cos` / `audius_declared_label`
  so a release published under a superseded label is distinguishable from a
  restated one. **Not yet exercised:** an actual mutating write (both live test
  tracks already matched), so `tracks.updateTrack` itself is unverified against Audius.
- **`publishStems`** — Audius models stems as a track relationship, not a multi-upload;
  needs the parent track id plus per-stem category mapping. Pairs naturally with the
  existing Sever/on-device stem engines.
- **`publishBundle`** — album/EP shape. Depends on playlist creation (3b).
- **Audius playlist creation** — `AudiusPlaylist` exists as a *local record only*.
  Add a write action so a BASE Station playlist becomes a real Audius playlist.

### 3b. Audius collectible minting (scaffolding already exists)
`mintCollectibleToAudius` and `syncAudiusCollectibles` are written and gracefully
no-op because the underlying `audiusClient` actions were never implemented. Wiring
these closes the collectibles loop **without building our own minting stack** — the
natural entry point if NFTs are wanted, because Audius/OpenAudio already has the
minting surface.

### 3c. Audius social writes
Repost, favorite, follow — currently no write actions exist. Lets a creator engage
from inside the studio instead of leaving for audius.co. Low technical risk; mostly
UI surface work plus scope confirmation on the OAuth grant.

### 3d. Tip bridging ($AUDIO)
We have a `Tip` entity and `processTip`, but it is platform-internal. Bridging to
Audius' native $AUDIO tipping means real value transfer — needs care around custody
and failure states. **Do not start before 3c.**

### 3e. Premium / USDC-gated content
Audius gated tracks are not surfaced and there is no purchase flow. Highest complexity
in this tier (payment rails + entitlement checks + refund semantics). Ships last.

### 3f. Creator-owned wallet publishing
Let creators anchor with their **own** wallet instead of the platform wallet, making
provenance self-sovereign. Deliberately last: it means key custody, per-creator gas,
and a dual-signer model in `chainAnchor.ts`. The platform-wallet default must remain,
or anchoring adoption collapses.

---

## Deferred infrastructure (flagged, not scheduled)

- **Live session → Audius archive** — `publishLiveSessionBundle` exists; confirm
  whether an archived show becomes an Audius release, and wire it if not.
- **Audius tracks as a 3D venue source** — venues stream from `VenuePlaylist` /
  `UserAsset` / radio. Audius stream URLs are not a first-class queue source. Note the
  licensing gate (`shared/audiusLicense.ts`) must apply here too: an All-Rights-Reserved
  track must not be played into a venue just because it is publicly streamable.

---

## Non-negotiable invariants (any future work must preserve these)

1. **Tokens never reach a client.** `AudiusCredential` is admin-RLS; endpoints return
   `toConnectionStatus()` only.
2. **Never invent an Audius id.** A fabricated or `sim_` id renders in-app as a real
   release. Missing credentials report `simulated`; unimplemented actions return 501.
3. **The release is composed server-side.** The browser moves bytes because our runtime
   cannot, but ownership, COS score and disclosure label always come from stored records.
4. **`aiAttributionUserId` only when our own label says `ai_generated`.** Stamping it on
   a human recording misdeclares the release on Audius.
5. **The import licence gate holds.** Only CC or artist-flagged open-remix tracks enter
   the library — All Rights Reserved is refused.
6. **Anchors are irreversible.** One implementation of what gets hashed and what the
   calldata means; corrections supersede, never overwrite.