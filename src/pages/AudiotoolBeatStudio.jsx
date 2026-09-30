import WorkspaceShell from '@/components/audiotool/workspace/WorkspaceShell';
import ArrangementView from '@/components/audiotool/workspace/ArrangementView';
import DrumMachinePanel from '@/components/audiotool/drums/DrumMachinePanel';
import PatternSynthPanel from '@/components/audiotool/synths/PatternSynthPanel';
import AutomationLanePanel from '@/components/audiotool/automation/AutomationLanePanel';
import SongstarterModule from '@/components/audiotool/songstarter/SongstarterModule';
import NexusContributionMeter from '@/components/audiotool/NexusContributionMeter';
import DemoSongPanel from '@/components/audiotool/songstarter/DemoSongPanel';
import { BridgeSessionContext } from '@/components/audiotool/songstarter/BridgeSessionContext';
import { WORKSPACES } from '@/lib/audiotool/workspaces';

export default function AudiotoolBeatStudio() {
  const showDemo = new URLSearchParams(window.location.search).get('demo') === '1';
  return (
    <WorkspaceShell workspace={WORKSPACES.beat}>
      {({ at, project, projectUrl }) => {
        const live = { nexus: project.nexus, projectUrl, connected: project.connected, version: project.version, onChanged: project.refresh };
        return (
          <div className="space-y-5">
            {showDemo && (
              <BridgeSessionContext.Provider value={{ at, nexus: project.nexus, projectUrl, onChanged: project.refresh }}>
                <section className="rack-module"><DemoSongPanel /></section>
              </BridgeSessionContext.Provider>
            )}
            <ArrangementView {...live} title="Beat timeline" />
            <div className="grid xl:grid-cols-[minmax(0,1fr)_22rem] gap-5">
              <div className="space-y-5 min-w-0">
                <DrumMachinePanel {...live} />
                <PatternSynthPanel {...live} />
                <AutomationLanePanel {...live} />
              </div>
              <aside className="space-y-5 min-w-0">
                <NexusContributionMeter nexus={project.nexus} projectUrl={projectUrl} counts={project.counts} onChange={() => {}} />
              </aside>
            </div>
            <SongstarterModule at={at} nexus={project.nexus} projectUrl={projectUrl} onChanged={project.refresh} />
          </div>
        );
      }}
    </WorkspaceShell>
  );
}