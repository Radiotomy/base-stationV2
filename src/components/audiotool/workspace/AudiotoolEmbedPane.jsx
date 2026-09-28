import { useEffect, useState } from 'react';
import { ExternalLink, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { openAudiotoolWindow } from '@/lib/audiotool/sideBySide';
import AudiotoolPopoutPane from './AudiotoolPopoutPane';

const TIMEOUT_MS = 8000;

/** Live Audiotool studio in a frame; falls back to the pop-out pane if it can't load. */
export default function AudiotoolEmbedPane({ session, onClose }) {
  const [state, setState] = useState('loading'); // loading | ready | blocked | signin

  useEffect(() => {
    setState('loading');
    const t = setTimeout(() => setState((s) => (s === 'loading' ? 'blocked' : s)), TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [session.projectUrl]);

  const onLoad = (e) => {
    // A same-origin readable document means the frame never reached Audiotool
    // (blocked/error page). A cross-origin frame throws here — that's success.
    try {
      const href = e.currentTarget.contentWindow.location.href;
      setState(/login|signin|oauth/i.test(href) ? 'signin' : 'blocked');
    } catch {
      setState('ready');
    }
  };

  const failed = state === 'blocked' || state === 'signin';
  return (
    <div className="h-full flex flex-col bg-card">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border text-xs">
        <span className="font-semibold">Audiotool</span>
        {state === 'loading' && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => openAudiotoolWindow(session.projectUrl)} title="Open in its own window">
            <ExternalLink className="w-3.5 h-3.5" /> Pop out
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Full screen BASE Station"><X className="w-4 h-4" /></Button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        {failed ? (
          <AudiotoolPopoutPane session={session} reason={state} />
        ) : (
          <iframe title="Audiotool studio" src={session.projectUrl} onLoad={onLoad}
            onError={() => setState('blocked')}
            allow="autoplay; microphone; midi; clipboard-read; clipboard-write; fullscreen"
            className="w-full h-full border-0" />
        )}
      </div>
    </div>
  );
}