import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, FolderOpen, RefreshCw, Cpu } from 'lucide-react';
import useNexusProject, { NEXUS_KINDS } from '@/hooks/useNexusProject';
import AudiotoolIngestSummary from '@/components/audiotool/AudiotoolIngestSummary';
import MidiCoProducerPanel from '@/components/audiotool/MidiCoProducerPanel';
import SongstarterModule from '@/components/audiotool/songstarter/SongstarterModule';
import NexusContributionMeter from '@/components/audiotool/NexusContributionMeter';
import ProtectExportPanel from '@/components/audiotool/ProtectExportPanel';
import FoundryDeviceMapper from '@/components/audiotool/foundry/FoundryDeviceMapper';
import AudienceCoopPanel from '@/components/audiotool/coop/AudienceCoopPanel';
import AudiotoolProjectList from '@/components/audiotool/AudiotoolProjectList';
import ActiveProjectHeader from '@/components/audiotool/ActiveProjectHeader';
import useAudiotoolProjectMeta from '@/hooks/useAudiotoolProjectMeta';
import ProjectPropertiesPanel from '@/components/audiotool/ProjectPropertiesPanel';
import CollaboratorsPanel from '@/components/audiotool/collab/CollaboratorsPanel';
import SessionExplorerPanel from '@/components/audiotool/explorer/SessionExplorerPanel';
import DrumMachinePanel from '@/components/audiotool/drums/DrumMachinePanel';
import PatternSynthPanel from '@/components/audiotool/synths/PatternSynthPanel';
import AutomationLanePanel from '@/components/audiotool/automation/AutomationLanePanel';

export default function AudiotoolProjectPanel({ at }) {
  const [url, setUrl] = useState('');
  const project = useNexusProject(at);
  const [ingest, setIngest] = useState({ loading: false, error: '', summary: null });
  const [openedUrl, setOpenedUrl] = useState('');
  const [telemetry, setTelemetry] = useState(null);
  const projectMeta = useAudiotoolProjectMeta(at, project.status === 'synced' ? openedUrl : '');

  const openProject = (link) => {
    setUrl(link.trim());
    setOpenedUrl(link.trim());
    setIngest({ loading: false, error: '', summary: null });
    project.open(link);
  };

  const sendToEngines = async () => {
    setIngest({ loading: true, error: '', summary: null });
    try {
      const { accessToken } = at.exportTokens();
      const { data } = await base44.functions.invoke('audiotoolIngestState', { project: url.trim(), access_token: accessToken });
      setIngest({ loading: false, error: '', summary: data });
    } catch (e) {
      setIngest({ loading: false, error: e?.response?.data?.error || e.message, summary: null });
    }
  };

  return (
    <section className="merc-card rounded-2xl p-6 space-y-4">
      <AudiotoolProjectList at={at} activeUrl={project.status === 'synced' ? openedUrl : ''} busy={project.status === 'opening'} onOpen={openProject} />
      <p className="text-xs text-muted-foreground">Or paste a project link from beta.audiotool.com/studio:</p>
      <div className="flex flex-col sm:flex-row gap-2">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://beta.audiotool.com/studio?project=…" />
        <Button className="merc-button" disabled={!url.trim() || project.status === 'opening'} onClick={() => openProject(url)}>
          {project.status === 'opening' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FolderOpen className="w-4 h-4 mr-2" />}
          Open & sync
        </Button>
      </div>
      {project.error && <p className="text-sm text-destructive">{project.error}</p>}

      {project.status === 'synced' && (
        <>
          <ActiveProjectHeader projectUrl={openedUrl} project={projectMeta} onRefresh={project.refresh} />
          {!project.connected && (
            <p className="text-sm text-destructive rounded-xl border border-destructive/40 px-3 py-2">
              Connection to Audiotool lost — hold off on changes until it reconnects, or they may not be saved.
            </p>
          )}
          <ProjectPropertiesPanel at={at} meta={projectMeta.meta} onSaved={projectMeta.setMeta} />
          <CollaboratorsPanel at={at} projectName={projectMeta.meta?.name} />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {NEXUS_KINDS.map(([t, label]) => (
              <div key={t} className="rounded-xl bg-secondary/60 px-3 py-2">
                <div className="text-lg font-bold">{project.counts[t] ?? 0}</div>
                <div className="text-[11px] text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
          <SessionExplorerPanel nexus={project.nexus} version={project.version} connected={project.connected} onChanged={project.refresh} />
          <Button variant="outline" onClick={sendToEngines} disabled={ingest.loading}>
            {ingest.loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Cpu className="w-4 h-4 mr-2" />}
            Send session state to BASE Engines
          </Button>
          {ingest.error && <p className="text-sm text-destructive">{ingest.error}</p>}
          {ingest.summary && <AudiotoolIngestSummary summary={ingest.summary} />}
          <NexusContributionMeter nexus={project.nexus} projectUrl={openedUrl} counts={project.counts} onChange={setTelemetry} />
          <MidiCoProducerPanel nexus={project.nexus} projectUrl={openedUrl} version={project.version} onChanged={project.refresh} />
          <DrumMachinePanel nexus={project.nexus} projectUrl={openedUrl} connected={project.connected} onChanged={project.refresh} />
          <PatternSynthPanel nexus={project.nexus} projectUrl={openedUrl} connected={project.connected} onChanged={project.refresh} />
          <AutomationLanePanel nexus={project.nexus} projectUrl={openedUrl} version={project.version} connected={project.connected} onChanged={project.refresh} />
          <SongstarterModule at={at} nexus={project.nexus} projectUrl={openedUrl} onChanged={project.refresh} />
          <FoundryDeviceMapper nexus={project.nexus} projectUrl={openedUrl} version={project.version} />
          <AudienceCoopPanel at={at} nexus={project.nexus} projectUrl={openedUrl} onChanged={project.refresh} />
          <ProtectExportPanel at={at} nexus={project.nexus} projectUrl={openedUrl} telemetry={telemetry} project={projectMeta} />
        </>
      )}
    </section>
  );
}