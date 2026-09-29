import { useState } from 'react';
import { Link } from 'react-router-dom';
import { openAudiotoolWindow } from '@/lib/audiotool/sideBySide';
import { ArrowLeft, Loader2 } from 'lucide-react';
import AudiotoolConnectCard from '@/components/audiotool/AudiotoolConnectCard';
import { BridgeSessionContext } from '@/components/audiotool/songstarter/BridgeSessionContext';
import useWorkspaceSession from '@/hooks/useWorkspaceSession';
import WorkspaceSessionStart from './WorkspaceSessionStart';
import WorkspaceTransportBar from './WorkspaceTransportBar';

/** Full-screen frame for a creative workspace: sign-in → pick/start a project → the instrument. */
export default function WorkspaceShell({ workspace, children }) {
  const s = useWorkspaceSession();
  const { audiotool, project } = s;
  const [blocked, setBlocked] = useState(false);
  const popOut = () => setBlocked(!openAudiotoolWindow(s.projectUrl));

  let body;
  if (audiotool.status === 'loading') {
    body = <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  } else if (audiotool.status !== 'authenticated') {
    body = <div className="max-w-2xl"><AudiotoolConnectCard {...audiotool} /></div>;
  } else if (!s.synced) {
    body = <WorkspaceSessionStart at={s.at} workspace={workspace} opening={project.status === 'opening'} error={project.error} onOpen={s.open} />;
  } else {
    body = (
      <BridgeSessionContext.Provider value={{ at: s.at, nexus: project.nexus, projectUrl: s.projectUrl, onChanged: project.refresh }}>
        {children(s)}
      </BridgeSessionContext.Provider>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <>
        {s.synced ? (
          <div className="border-b border-[#FFC26E]/15 shadow-[inset_0_-1px_0_rgba(255,255,255,0.05),0_8px_24px_-12px_rgba(0,0,0,0.8)]">
            <WorkspaceTransportBar workspace={workspace} projectUrl={s.projectUrl} meta={s.meta} connected={project.connected} onRefresh={project.refresh}
              onToggleSplit={popOut} />
          </div>
        ) : (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-2">
            <Link to="/audiotool" className="text-sm text-muted-foreground inline-flex items-center gap-1.5 hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" /> Audiotool Bridge
            </Link>
            <p className="rack-readout text-[10px] mt-4">Liquid Mercury Rack</p>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight mt-1">{workspace.label}</h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">{workspace.desc}</p>
          </div>
        )}
        {blocked && (
          <p className="max-w-7xl mx-auto px-4 sm:px-6 pt-3 text-xs text-amber-300">
            Pop-up blocked — allow pop-ups for BASE Station, or <a href={s.projectUrl} target="_blank" rel="noreferrer" className="underline">open Audiotool in a new tab</a>.
          </p>
        )}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">{body}</div>
      </>
    </div>
  );
}