import { Timer } from 'lucide-react';
import StudioPageHeader from '@/components/studio/StudioPageHeader';
import AudiotoolConnectCard from '@/components/audiotool/AudiotoolConnectCard';
import WorkspaceSessionStart from '@/components/audiotool/workspace/WorkspaceSessionStart';
import { BridgeSessionContext } from '@/components/audiotool/songstarter/BridgeSessionContext';
import PreStarterPanel from '@/components/audiotool/prestarter/PreStarterPanel';
import useWorkspaceSession from '@/hooks/useWorkspaceSession';

export default function PreStarterStudio() {
  const s = useWorkspaceSession();
  const authed = s.audiotool.status === 'authenticated';
  const session = s.synced ? { at: s.at, nexus: s.project.nexus, projectUrl: s.projectUrl, onChanged: s.project.refresh } : null;

  return (
      <div className="min-h-screen">
        <StudioPageHeader icon={Timer} title="60s Pre-Starter" accent="amber" backTo="/studios"
          subtitle="Generate a full 60-second song sketch, preview it here, then send it to Audiotool" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          {!authed && <AudiotoolConnectCard {...s.audiotool} />}
          {authed && !s.synced && (
            <WorkspaceSessionStart at={s.at} workspace={{ label: 'Pre-Starter' }}
              opening={s.project.status === 'opening'} error={s.project.error} onOpen={s.open} />
          )}
          <section className="rounded-2xl border border-border p-5">
            <BridgeSessionContext.Provider value={session}>
              <PreStarterPanel />
            </BridgeSessionContext.Provider>
          </section>
        </div>
      </div>
  );
}