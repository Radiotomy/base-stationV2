import WorkspaceShell from '@/components/audiotool/workspace/WorkspaceShell';
import ArrangementView from '@/components/audiotool/workspace/ArrangementView';
import EngineRenderPicker from '@/components/audiotool/workspace/EngineRenderPicker';
import ChordProgressionPanel from '@/components/audiotool/harmony/ChordProgressionPanel';
import MidiCoProducerPanel from '@/components/audiotool/MidiCoProducerPanel';
import NexusContributionMeter from '@/components/audiotool/NexusContributionMeter';
import NotesCompanionCard from '@/components/audiotool/harmony/NotesCompanionCard';
import { WORKSPACES } from '@/lib/audiotool/workspaces';
import { useState } from 'react';
import MercuryResultModule from '@/components/audiotool/mercury/MercuryResultModule';
import CadenceBedMaker from '@/components/cadence/CadenceBedMaker';

export default function AudiotoolHarmonyStudio() {
  const [bedKey, setBedKey] = useState(0);
  return (
    <WorkspaceShell workspace={WORKSPACES.harmony}>
      {({ project, projectUrl }) => {
        const live = { nexus: project.nexus, projectUrl, connected: project.connected, version: project.version, onChanged: project.refresh };
        return (
          <div className="space-y-5">
            <ArrangementView {...live} title="Song structure" />
            <div className="grid xl:grid-cols-[minmax(0,1fr)_22rem] gap-5">
              <div className="space-y-5 min-w-0">
                <ChordProgressionPanel {...live} />
                <MidiCoProducerPanel {...live} />
              </div>
              <aside className="space-y-5 min-w-0">
                <NotesCompanionCard projectUrl={projectUrl} />
                <NexusContributionMeter nexus={project.nexus} projectUrl={projectUrl} counts={project.counts} onChange={() => {}} />
                <MercuryResultModule title="Render a Cadence bed" hint="Type a progression — Cadence plays it. The finished bed appears in the list below, ready to place.">
                  <CadenceBedMaker key={bedKey} title="Harmony bed" onReady={() => setBedKey((k) => k + 1)} />
                </MercuryResultModule>
                <EngineRenderPicker key={`picker-${bedKey}`} provider="musicgenchord" aiTool="cadence_bed" title="Cadence beds"
                  hint="Instrumental beds Cadence rendered from your chords."
                  linkTo="/lead-sheet-studio" linkLabel="Write a full score in Lead Sheet Studio" />
              </aside>
            </div>
          </div>
        );
      }}
    </WorkspaceShell>
  );
}