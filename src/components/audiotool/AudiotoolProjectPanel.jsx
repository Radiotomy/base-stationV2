import { useEffect, useState } from 'react';
import { readDeepLink, syncAddressBar } from '@/lib/audiotool/deepLinks';
import { templateProjectName, createProject, studioUrl } from '@/lib/audiotool/audiotoolProjects';
import InfoTip from '@/components/common/InfoTip';
import TIPS from '@/lib/audiotool/bridgeTips';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, FolderOpen } from 'lucide-react';
import useNexusProject, { NEXUS_KINDS } from '@/hooks/useNexusProject';
import EngineIngestDebug from '@/components/audiotool/EngineIngestDebug';
import WorkspaceLauncher from '@/components/audiotool/workspace/WorkspaceLauncher';
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

export default function AudiotoolProjectPanel({ at }) {
  const [url, setUrl] = useState('');
  const project = useNexusProject(at);
  const [openedUrl, setOpenedUrl] = useState('');
  const [telemetry, setTelemetry] = useState(null);
  const projectMeta = useAudiotoolProjectMeta(at, project.status === 'synced' ? openedUrl : '');

  const [focus] = useState(() => readDeepLink().focus);

  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState('');

  // Templates belong to Audiotool, so they can't be opened live — copy one into
  // the creator's own projects first, then open that copy.
  const openLink = async (link) => {
    const template = templateProjectName(link.trim());
    setCopyError('');
    if (!template) return openProject(link);
    setCopying(true);
    try {
      const copy = await createProject(at, `BASE Template ${new Date().toLocaleString()}`, template);
      openProject(studioUrl(copy));
    } catch (e) {
      setCopyError(`Audiotool didn't allow copying this template (${e.message}). Open it on audiotool.com, save it to your own projects, then pick it from the list above.`);
    }
    setCopying(false);
  };

  const openProject = (link) => {
    setUrl(link.trim());
    setOpenedUrl(link.trim());
    syncAddressBar(link.trim());
    project.open(link);
  };

  // A deep link (?open=…) opens its project as soon as the Bridge loads.
  useEffect(() => {
    const { open } = readDeepLink();
    if (open) openProject(open);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="merc-card rounded-2xl p-6 space-y-4">
      <AudiotoolProjectList at={at} activeUrl={project.status === 'synced' ? openedUrl : ''} busy={project.status === 'opening'} onOpen={openProject} />
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">Or paste a project link from beta.audiotool.com/studio: <InfoTip text={TIPS.pasteLink} /></p>
      <div className="flex flex-col sm:flex-row gap-2">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://beta.audiotool.com/studio?project=…" />
        <Button className="merc-button" disabled={!url.trim() || copying || project.status === 'opening'} onClick={() => openLink(url)}>
          {copying || project.status === 'opening' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FolderOpen className="w-4 h-4 mr-2" />}
          {copying ? 'Copying template…' : 'Open & sync'}
        </Button>
      </div>
      {copyError && <p className="text-sm text-destructive">{copyError}</p>}
      {project.error && <p className="text-sm text-destructive">{project.error}</p>}

      {project.status === 'synced' && (
        <>
          <ActiveProjectHeader projectUrl={openedUrl} project={projectMeta} onRefresh={project.refresh} />
          <WorkspaceLauncher projectUrl={openedUrl} />
          {!project.connected && (
            <p className="text-sm text-destructive rounded-xl border border-destructive/40 px-3 py-2">
              Connection to Audiotool lost — hold off on changes until it reconnects, or they may not be saved.
            </p>
          )}
          <ProjectPropertiesPanel at={at} meta={projectMeta.meta} onSaved={projectMeta.setMeta} />
          <CollaboratorsPanel at={at} projectName={projectMeta.meta?.name} />
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">Live project counts <InfoTip text={TIPS.counts} /></p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {NEXUS_KINDS.map(([t, label]) => (
              <div key={t} className="rounded-xl bg-secondary/60 px-3 py-2">
                <div className="text-lg font-bold">{project.counts[t] ?? 0}</div>
                <div className="text-[11px] text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
          <SessionExplorerPanel nexus={project.nexus} projectUrl={openedUrl} focus={focus} version={project.version} connected={project.connected} onChanged={project.refresh} />
          <EngineIngestDebug at={at} projectUrl={url} />
          <NexusContributionMeter nexus={project.nexus} projectUrl={openedUrl} counts={project.counts} onChange={setTelemetry} />
          <FoundryDeviceMapper nexus={project.nexus} projectUrl={openedUrl} version={project.version} />
          <AudienceCoopPanel at={at} nexus={project.nexus} projectUrl={openedUrl} onChanged={project.refresh} />
          <ProtectExportPanel at={at} nexus={project.nexus} projectUrl={openedUrl} telemetry={telemetry} project={projectMeta} />
        </>
      )}
    </section>
  );
}