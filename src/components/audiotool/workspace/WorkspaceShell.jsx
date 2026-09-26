import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import BetaGate from '@/components/auth/BetaGate';
import AudiotoolConnectCard from '@/components/audiotool/AudiotoolConnectCard';
import { BridgeSessionContext } from '@/components/audiotool/songstarter/BridgeSessionContext';
import useWorkspaceSession from '@/hooks/useWorkspaceSession';
import WorkspaceSessionStart from './WorkspaceSessionStart';
import WorkspaceTransportBar from './WorkspaceTransportBar';

/** Full-screen frame for a creative workspace: sign-in → pick/start a project → the instrument. */
export default function WorkspaceShell({ workspace, children }) {
  const s = useWorkspaceSession();
  const { audiotool, project } = s;

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
      <BetaGate feature="Audiotool Bridge">
        {s.synced ? (
          <WorkspaceTransportBar workspace={workspace} projectUrl={s.projectUrl} meta={s.meta} connected={project.connected} onRefresh={project.refresh} />
        ) : (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-2">
            <Link to="/audiotool" className="text-sm text-muted-foreground inline-flex items-center gap-1.5 hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" /> Audiotool Bridge
            </Link>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight mt-4">{workspace.label}</h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">{workspace.desc}</p>
          </div>
        )}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">{body}</div>
      </BetaGate>
    </div>
  );
}