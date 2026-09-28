# Audiotool Bridge — Code Index

A reviewer's map to the Audiotool-specific code in BASE Station. Everything else in the repo is the wider provenance platform the Bridge plugs into.

**Live:** https://base-station.base44.app/audiotool · **Submission kit:** `/hackathon` · **Pitch:** [README.md](./README.md)

---

## Entry pages
| Route | File |
|---|---|
| `/audiotool` (Bridge hub) | `src/pages/AudiotoolStudio.jsx` |
| `/audiotool-callback` (OAuth return) | `src/pages/AudiotoolCallback.jsx` |
| `/studios/audiotool/beat` | `src/pages/AudiotoolBeatStudio.jsx` |
| `/studios/audiotool/harmony` | `src/pages/AudiotoolHarmonyStudio.jsx` |
| `/studios/audiotool/vocal` | `src/pages/AudiotoolVocalLab.jsx` |
| `/pre-starter` | `src/pages/PreStarterStudio.jsx` |
| `/audiotool/guide` | `src/pages/AudiotoolGuide.jsx` |
| `/hackathon`, `/hackathon/deck` | `src/pages/Hackathon.jsx`, `src/pages/HackathonDeck.jsx` |

## Nexus peer client (live session core)
- `src/lib/audiotool/nexusClient.js` — connects to the live Nexus document
- `src/lib/audiotool/nexusWasm.js`, `nexusOrdering.js`, `nexusErrors.js`
- `src/hooks/useAudiotool.js`, `useNexusProject.js`, `useWorkspaceSession.js`, `useAudiotoolProjectMeta.js`
- `src/lib/audiotool/audiotoolTokens.js`, `audiotoolProjects.js`, `deepLinks.js`, `sideBySide.js` (pop-out window)

## 01 · Songstarter / ideation
- `src/components/audiotool/songstarter/` — hub, Forge loops, SFX, Vibe→Session, Audius remix, demo song, send button
- `src/components/audiotool/prestarter/` + `src/lib/audiotool/preStarter.js` + `src/hooks/usePreStarterPlayer.js`
- `src/lib/audiotool/songstarterGen.js`, `vibes.js`, `instrumentChain.js`, `demoSong.js`, `sendToAudiotool.js`, `localAudio.js`

## 02 · Theory & AI composition
- `src/components/audiotool/harmony/` — chord progression, chord pads, lead-sheet import
- `src/components/audiotool/MidiCoProducerPanel.jsx`, `coproducer/CoProducerHistory.jsx`
- `src/lib/audiotool/chordWriter.js`, `midiCoProducer.js`, `midiPattern.js`, `arrangement.js`
- `src/components/cadence/CadenceBedMaker.jsx`, `src/lib/cadence/renderCadenceBed.js`

## 03 · Sound design
- `src/components/audiotool/drums/`, `synths/`, `automation/`, `vocal/`
- `src/lib/audiotool/drumPattern.js`, `synthPattern.js`, `patternDevice.js`, `automationLane.js`, `deviceParams.js`, `cableSync.js`
- `src/components/audiotool/foundry/` + `src/hooks/useFoundryRemote.js`, `useFoundryDeviceMap.js`, `useDevicePush.js`

## 04 · Play & live
- `src/components/audiotool/coop/` + `src/lib/audiotool/runCoopCommand.js`

## 05 · DAW integration
- `src/components/audiotool/workspace/` — shell, transport, arrangement view, region inspector
- `src/components/audiotool/explorer/` + `src/lib/audiotool/sessionExplorer.js`, `familyColors.js`, `audiotoolManual.js`
- `src/components/audiotool/collab/` + `src/lib/audiotool/projectRoles.js`
- `src/components/audiotool/NexusContributionMeter.jsx`, `src/lib/audiotool/nexusTelemetry.js`, `src/hooks/useAiDeviceIds.js`
- `src/docs/audiotool-bridge/` — Python protobuf bridge (`dts_to_proto.py`, `app.py`, router/state)

## 06 · Distribution
- `src/components/audiotool/ProtectExportPanel.jsx`, `DistributeToAudiusPanel.jsx`, `ProvenancePipelineStatus.jsx`
- `src/components/audiotool/contests/` + `src/lib/audiotool/contestEntry.js`, `protectExport.js`

## Backend functions
- `base44/functions/audiotoolConfig` — OAuth/client config (secrets stay server-side)
- `base44/functions/audiotoolIngestState` — session state ingestion
- `base44/functions/audiotoolProtectExport`, `sealProtectedExport` — watermark → C2PA → anchor pipeline

## Data (entities)
- `NexusTelemetryEvent` — private AI-invocation log driving the human/AI split
- `AudiotoolContestLink` — project ↔ Audius contest link
- `FoundryDeviceMap` — Foundry node ↔ Audiotool device mapping

## Help copy
- `src/components/help/audiotoolHelpSections.jsx`, `AudiotoolManualSection.jsx`, `src/lib/audiotool/bridgeTips.js