import { Button } from '@/components/ui/button';
import { Loader2, LogIn, LogOut, Link2, AlertTriangle } from 'lucide-react';
import { AUDIOTOOL_APP_ORIGIN, AUDIOTOOL_REDIRECT_URL, isOnPublishedOrigin } from '@/lib/audiotool/nexusClient';

export default function AudiotoolConnectCard({ status, userName, error, login, logout }) {
  const onLive = isOnPublishedOrigin();

  return (
    <section className="merc-card rounded-2xl p-6 space-y-3">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><Link2 className="w-5 h-5" /> Audiotool</h2>
          <p className="text-sm text-muted-foreground">
            Connect your Audiotool account to open your projects live in BASE Station (read & write access).
          </p>
        </div>
        {status === 'loading' && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
        {status === 'unauthenticated' && (
          <Button className="merc-button" onClick={login} disabled={!onLive}>
            <LogIn className="w-4 h-4 mr-2" /> Connect Audiotool
          </Button>
        )}
        {status === 'authenticated' && (
          <div className="flex items-center gap-3">
            <span className="text-sm">Connected as <strong>{userName}</strong></span>
            <Button variant="outline" size="sm" onClick={logout}><LogOut className="w-4 h-4 mr-2" /> Disconnect</Button>
          </div>
        )}
      </div>
      {status === 'unauthenticated' && !onLive && (
        <p className="text-xs text-amber-300 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>
            You're in the editor preview. Audiotool sends sign-ins back to {AUDIOTOOL_REDIRECT_URL}, so connect from the live app:{' '}
            <a href={`${AUDIOTOOL_APP_ORIGIN}/audiotool`} target="_blank" rel="noreferrer" className="underline font-semibold">open {AUDIOTOOL_APP_ORIGIN}/audiotool</a>
          </span>
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  );
}