import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBridgeSession } from './BridgeSessionContext';
import { VIBES } from '@/lib/audiotool/vibes';
import { runForgeLoop, runSfx, errorText } from '@/lib/audiotool/songstarterGen';
import { loadAsWavFile } from '@/lib/audiotool/localAudio';
import { sendToAudiotool } from '@/lib/audiotool/sendToAudiotool';

/** Pick a mood → a Forge loop and a riser are generated and placed on the timeline in one go. */
export default function VibeSessionStarter() {
  const session = useBridgeSession();
  const [vibeId, setVibeId] = useState(VIBES[0].id);
  const [step, setStep] = useState('');
  const vibe = VIBES.find((v) => v.id === vibeId);

  const start = async () => {
    try {
      setStep('Generating loop and riser…');
      const [loop, sfx] = await Promise.all([
        runForgeLoop({ prompt: vibe.loop, category: vibe.category, bpm: vibe.bpm, duration: 8 }),
        runSfx({ text: vibe.sfx, duration: 6, loop: false }),
      ]);
      setStep('Placing on your timeline…');
      const loopName = `${vibe.label} loop`;
      await sendToAudiotool({ ...session, file: await loadAsWavFile(loop.audioUrl, loopName), name: loopName, bpm: loop.bpm, aiTool: 'songstarter_loop', prompt: vibe.loop });
      const sfxName = `${vibe.label} riser`;
      await sendToAudiotool({ ...session, file: await loadAsWavFile(sfx.audioUrl, sfxName), name: sfxName, aiTool: 'songstarter_sfx', prompt: vibe.sfx });
      toast.success(`"${vibe.label}" is on your timeline — loop and riser placed.`);
      session.onChanged?.();
    } catch (e) {
      toast.error(`Couldn't start the vibe: ${errorText(e)}`);
    } finally {
      setStep('');
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Pick a mood and BASE Station writes your first bars: a tempo-locked BASE Forge loop plus a transition riser, both dropped straight onto the Audiotool timeline. 5 credits.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {VIBES.map((v) => (
          <button key={v.id} onClick={() => setVibeId(v.id)} disabled={!!step}
            className={`rounded-xl border px-3 py-2 text-left transition-colors ${v.id === vibeId ? 'border-accent bg-accent/10' : 'border-border hover:border-foreground/30'}`}>
            <p className="text-sm font-semibold">{v.label}</p>
            <p className="text-[11px] text-muted-foreground">{v.bpm} BPM · {v.category.replace('_', ' ')}</p>
          </button>
        ))}
      </div>
      <Button className="merc-button" onClick={start} disabled={!!step || !session?.nexus}>
        {step ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
        {step || `Start "${vibe.label}" session`}
      </Button>
    </div>
  );
}