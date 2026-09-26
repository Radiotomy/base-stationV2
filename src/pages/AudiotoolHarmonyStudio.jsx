import WorkspaceShell from '@/components/audiotool/workspace/WorkspaceShell';
import ArrangementView from '@/components/audiotool/workspace/ArrangementView';
import EngineRenderPicker from '@/components/audiotool/workspace/EngineRenderPicker';
import ChordProgressionPanel from '@/components/audiotool/harmony/ChordProgressionPanel';
import MidiCoProducerPanel from '@/components/audiotool/MidiCoProducerPanel';
import NexusContributionMeter from '@/components/audiotool/NexusContributionMeter';
import { WORKSPACES } from '@/lib/audiotool/workspaces';

export default function AudiotoolHarmonyStudio() {
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
                <NexusContributionMeter nexus={project.nexus} projectUrl={projectUrl} counts={project.counts} onChange={() => {}} />
                <EngineRenderPicker provider="musicgenchord" aiTool="cadence_bed" title="Cadence beds"
                  hint="Instrumental beds Cadence rendered from your Lead Sheet chords."
                  linkTo="/lead-sheet-studio" linkLabel="Render a new bed in Lead Sheet Studio" />
              </aside>
            </div>
          </div>
        );
      }}
    </WorkspaceShell>
  );
}