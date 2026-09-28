import { useState } from 'react';
import { ExternalLink, Columns2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { openAudiotoolWindow } from '@/lib/audiotool/sideBySide';
import SessionExplorerPanel from '@/components/audiotool/explorer/SessionExplorerPanel';

/** Fallback when Audiotool can't load in a frame: a docked pop-out window + the live explorer. */
export default function AudiotoolPopoutPane({ session, reason }) {
  const { projectUrl, project } = session;
  const [blocked, setBlocked] = useState(false);
  return (
    <div className="h-full overflow-y-auto p-5 space-y-5">
      <div className="merc-card rounded-2xl p-6 text-center space-y-3">
        <Columns2 className="w-7 h-7 mx-auto text-accent" />
        <h3 className="font-bold text-lg">{reason === 'signin' ? 'Finish signing in to Audiotool' : 'Open Audiotool alongside'}</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          {reason === 'signin'
            ? 'Audiotool needs you to sign in in its own window. Once you do, playback and edits stay in sync with this workspace.'
            : 'Audiotool didn\'t load inside BASE Station, so open it in its own window. Everything you do here syncs to it live.'}
        </p>
        <Button className="merc-button rounded-full" onClick={() => setBlocked(!openAudiotoolWindow(projectUrl))}>
          <ExternalLink className="w-4 h-4" /> Open Audiotool in a new window
        </Button>
        <p className="text-xs text-muted-foreground">Tip: resize the two windows side by side.</p>
        {blocked && (
          <p className="text-xs text-amber-300">
            Pop-up blocked — <a href={projectUrl} target="_blank" rel="noreferrer" className="underline">open it in a new tab</a> instead.
          </p>
        )}
      </div>
      <SessionExplorerPanel nexus={project.nexus} projectUrl={projectUrl} version={project.version}
        connected={project.connected} onChanged={project.refresh} />
    </div>
  );
}