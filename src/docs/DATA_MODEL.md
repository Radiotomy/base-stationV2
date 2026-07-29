# BASE Station — Data Model

Entity schemas live in `base44/entities/<Name>.jsonc`. Each file is the complete
JSON schema plus its row-level security rules; writing the file replaces the
stored schema, so always write it whole.

Every record also carries platform built-ins that are never declared:
`id`, `created_date`, `updated_date`, `created_by_id`.

---

## 1. `UserAsset` — the spine

Everything a creator makes lands here: tracks, lyrics, cover art, stems, videos,
masters, harmonies, mashups, visualizers, SFX.

**Lineage.** `parent_asset_id` points at the asset a thing was derived from, so a
stem knows its source master and a mashup knows its parents. `stem_type` names
which stem a stem is. Derived assets **inherit the most AI-intensive label in
their chain** — this is what stops a stem from laundering its origin.

**Provenance fields (first-class schema, not a metadata blob):**

| Field | Meaning |
| --- | --- |
| `ai_label` | RIAA/IFPI track-level label: `ai_generated` / `ai_assisted` / `human` |
| `ai_disclosure_label` | Label derived from the participation score |
| `ai_disclosure_basis` | Human-readable justification for the label |
| `human_participation_score` | 0–100 Creative Ownership Score |
| `participation_signals` | Per-signal breakdown of how the score was built |
| `ddex_ai_metadata` | Booleans: lyrical / composition / instrumentation / vocals / post-production |
| `c2pa_provenance_hash` | Manifest checksum anchoring metrics to the audio container |

`origin` (`creator` / `loudly` / `audius`) exists for legal separation between
user-generated content and imported catalogue.

## 2. Entity map by domain

**Creator workspace** — `UserAsset`, `Workspace`, `Project`, `GenerationJob`,
`StudioHistory`, `UserCredit`, `CreditLog`, `APIUsageLog`, `MusicFinetune`,
`VoicePersona`, `LoopSample`, `PromptTemplate`, `CustomChip`

**Community** — `TrackSubmission`, `Playlist`, `PlaylistTrack`, `TrackChart`,
`RadioChannel`, `AudiusRadioChannel`, `AudiusPlaylist`, `LoudlyPlaylist`,
`Challenge`, `ChallengeSubmission`, `ArtistProfile`,
`FeaturedArtistApplication`, `Comment`, `Reaction`, `Follow`,
`ActivityFeedItem`, `Badge`, `UserBadge`, `UserXP`, `Leaderboard` data

**Live** — `LiveSession`, `LiveChatMessage`, `LiveQuest`, `LiveVisualPreset`,
`LiveSessionBundle`, `PerformerAvatar`

**Fan economy** — `FanClub`, `FanClubMembership`, `Collectible`,
`CollectibleClaim`, `FanAction`, `Tip`

**Provenance & chain** — `BaseTrackRegistry`, `SolanaTrackRegistry`,
`BlockchainTransaction`, `BlockchainAuditReport`, `BaseMarkBenchmark`

**Governance & transparency** — `TransparencyFlag`, `CosProposal`,
`CosProposalVote`, `NewsArticle`

**Forum** — `ForumMember`, `ForumThread`, `ForumReply`

**Ops** — `ErrorLog`, `AnalyticsEvent`, `ProviderBalance`, `BetaAccessRequest`,
`MarketingContent`, `SocialMediaCard`

**Built-in** — `User` (never created by us; `role` is customised, everything
else is platform-owned)

## 3. Notable entities

### `BaseTrackRegistry` / `SolanaTrackRegistry`
The lookup target for a recovered watermark payload. A detection is only ever
reported as a match after the payload resolves to a registry row — the detector
alone never asserts identity.

### `BaseMarkBenchmark`
Measured robustness, one row per attack per run: `layer`, `attack`, `trials`,
`survived`, `survival_pct`, `mean_strength`, `cascaded`, `source_seconds`.
Written by `benchmarkBaseMark`, read by the in-app robustness chart. Admin-write,
public-read — the numbers are published, failures included.

### `TransparencyFlag`
Creator-reported record of a downstream DSP flag or block, including the track's
COS at the time and whether a provenance manifest was submitted. Public read: the
point is to publish the friction.

### `CosProposal` / `CosProposalVote`
Community governance over the COS weights. A proposal names a `signal_key`, its
`current_weight` and a `proposed_weight`; admins move it out of `open` based on
consensus. The rules that judge creators are public and amendable.

### `GenerationJob`
Job ledger for every AI generation: `job_type`, `provider`, `status`,
`provider_job_id`, `input_data`, `output_url`, `credits_used`, `ai_label`. The
`provider_job_id` is what makes the poll/webhook finalize pattern resumable.

## 4. RLS conventions

Rules are declared under an `rls` key in the entity file. The patterns used
throughout:

| Pattern | Applied to |
| --- | --- |
| Owner-only, all four ops | `UserAsset`, `MusicFinetune`, `Workspace`, `Project`, `GenerationJob`, `UserCredit` |
| Owner-or-admin read, owner write | Most creator-scoped entities |
| Public read, owner/admin write | `TrackSubmission`, `Playlist`, `TransparencyFlag`, `CosProposal`, `BaseMarkBenchmark` |
| Public read, admin-only write | `RadioChannel`, `NewsArticle`, `Badge`, `Challenge` |
| Admin-only everything | `ErrorLog`, `MarketingContent`, `APIUsageLog` writes, `ForumMember` |

Two rules worth internalising:

1. **Restricting a write counts as much as restricting a read.** Open writes are
   the most common miss — public-read entities still need owner-or-admin update
   and delete.
2. **Ownership fields are set from the token, not the payload.** Creates are
   constrained with `data.user_id: "{{user.id}}"` so a client can't create a row
   owned by someone else.

Guest forum participation is the deliberate exception: `ForumMember`,
`ForumThread` and `ForumReply` are admin-only at the RLS layer and all guest
writes go through the `forumApi` function, which validates the guest token
server-side.

## 5. Field-size discipline

Never store large content in an entity field — no base64 audio, no PDF bytes, no
blobs. Upload via `UploadFile` (or `UploadPrivateFile` for non-public material)
and store the resulting URL. Oversized fields break record operations for the
whole row.