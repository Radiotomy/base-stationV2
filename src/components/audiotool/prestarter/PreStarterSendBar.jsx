import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Layers, Disc3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import InfoTip from '@/components/common/InfoTip';
import { sendToAudiotool, endOfAudioTimeline } from '@/lib/audiotool/sendToAudiotool';
import { mixToFile, bufferToFile } from '@/lib/audiotool/preStarter';
import { errorText } from '@/lib/audiotool/songstarterGen';
import { requestProjectCover } from '@/lib/audiotool/projectCovers';

/** Push the approved pre-starter to Audiotool — as one mix or as aligned stems. */
export default function PreStarterSendBar({ session, lanes, gainOf, bpm, title, prompts, vibeLabel = '' }) {
  const [sending, setSending] = useState('');
  const ready = lanes.every((l) => l.buffer);
  const disabled = !!sending || !ready || !session?.nexus;

  const send = async (mode) => {
    setSending(mode);
    try {
      if (mode === 'mix') {
        const audible = lanes.map((l) => ({ buffer: l.buffer, gain: gainOf(l.key) }));
        const file = await mixToFile(audible, title);
        const { bar } = await sendToAudiotool({ ...session, file, name: title, bpm, aiTool: 'songstarter_loop', prompt: prompts.bed });
        toast.success(`"${title}" placed as one region at bar ${bar}.`);
      } else {
        // Every stem is full song length, so one shared start keeps them aligned.
        const atTicks = endOfAudioTimeline(session.nexus);
        let bar = 1;
        for (const l of lanes) {
          const name = `${title} · ${l.label}`;
          ({ bar } = await sendToAudiotool({ ...session, file: bufferToFile(l.buffer, name), name, bpm, aiTool: l.aiTool, prompt: prompts[l.key], atTicks }));
        }
        toast.success(`3 aligned stems placed at bar ${bar} — Bed, Drums, Riser.`);
      }
      session.onChanged?.();
      // Non-blocking; the function reuses an existing cover for this project.
      if (session.projectUrl) requestProjectCover({ project_url: session.projectUrl, source: 'prestarter', vibe_label: vibeLabel, prompt: prompts.bed, title });
    } catch (e) {
      toast.error(`Couldn't send to Audiotool: ${errorText(e)}`);
    } finally {
      setSending('');
    }
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-1.5">
          <Button className="merc-button flex-1" disabled={disabled} onClick={() => send('mix')}>
            {sending === 'mix' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Disc3 className="w-4 h-4" />} Send as one mix
          </Button>
          <InfoTip text="Mixes the three lanes exactly as you hear them (volume, mute, solo) into one 60s WAV on a single new track." />
        </div>
        <div className="flex items-center gap-1.5">
          <Button className="merc-button-dark flex-1 hover:brightness-125" disabled={disabled} onClick={() => send('stems')}>
            {sending === 'stems' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />} Send as stems
          </Button>
          <InfoTip text="Sends Bed, Drums and Riser as three separate regions starting on the same bar, so you can edit each one in Audiotool." />
        </div>
      </div>
      {!session?.nexus && <p className="text-xs text-muted-foreground">Open an Audiotool project to send — you can preview without one.</p>}
    </div>
  );
}