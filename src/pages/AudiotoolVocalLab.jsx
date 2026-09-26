import WorkspaceShell from '@/components/audiotool/workspace/WorkspaceShell';
import ArrangementView from '@/components/audiotool/workspace/ArrangementView';
import EngineRenderPicker from '@/components/audiotool/workspace/EngineRenderPicker';
import VocalTakeRecorder from '@/components/audiotool/vocal/VocalTakeRecorder';
import VocalHarmonyPanel from '@/components/audiotool/vocal/VocalHarmonyPanel';
import NexusContributionMeter from '@/components/audiotool/NexusContributionMeter';
import { WORKSPACES } from '@/lib/audiotool/workspaces';

export default function AudiotoolVocalLab() {
  return (
    <WorkspaceShell workspace={WORKSPACES.vocal}>
      {({ project, projectUrl }) => (
        <div className="space-y-5">
          <ArrangementView nexus={project.nexus} version={project.version} onChanged={project.refresh} title="Vocal timeline" />
          <div className="grid xl:grid-cols-[minmax(0,1fr)_22rem] gap-5">
            <div className="space-y-5 min-w-0">
              <VocalTakeRecorder />
              <VocalHarmonyPanel />
            </div>
            <aside className="space-y-5 min-w-0">
              <NexusContributionMeter nexus={project.nexus} projectUrl={projectUrl} counts={project.counts} onChange={() => {}} />
              <EngineRenderPicker provider="diffsinger" aiTool="cantor_vocal" title="Cantor vocals"
                hint="Your Lead Sheet melodies, sung by Cantor."
                linkTo="/lead-sheet-studio" linkLabel="Render a new vocal in Lead Sheet Studio" />
            </aside>
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}