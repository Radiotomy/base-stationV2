import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Wand2, Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useBridgeSession } from '@/components/audiotool/songstarter/BridgeSessionContext';
import { VIBES } from '@/lib/audiotool/vibes';
import { errorText } from '@/lib/audiotool/songstarterGen';
import { LANES, vibeById, promptsFor, generateLane, arrangeLane, laneSpan, songSeconds } from '@/lib/audiotool/preStarter';
import usePreStarterPlayer from '@/hooks/usePreStarterPlayer';
import PreStarterLane from './PreStarterLane';
import PreStarterSendBar from './PreStarterSendBar';

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** 60s Pre-Starter — shared by the Songstarter tab and the standalone studio page. */
export default function PreStarterPanel() {
  const session = useBridgeSession();
  const [vibeId, setVibeId] = useState(VIBES[0].id);
  const [bpm, setBpm] = useState(VIBES[0].bpm);
  const [extra, setExtra] = useState('');
  const [lanes, setLanes] = useState(LANES.map((l) => ({ ...l, buffer: null })));
  const [busy, setBusy] = useState({});
  const player = usePreStarterPlayer(lanes);
  const vibe = vibeById(vibeId);
  const prompts = promptsFor(vibe, extra);
  const total = songSeconds(bpm);
  const anyBusy = Object.values(busy).some(Boolean);

  const build = async (key) => {
    setBusy((b) => ({ ...b, [key]: true }));
    try {
      const { buffer: raw } = await generateLane(key, prompts, bpm);
      const buffer = await arrangeLane(key, raw, bpm);
      setLanes((ls) => ls.map((l) => (l.key === key ? { ...l, buffer, span: laneSpan(key, raw, bpm) } : l)));
    } catch (e) {
      toast.error(`${key} failed: ${errorText(e)}`);
    } finally {
      setBusy((b) => ({ ...b, [key]: false }));
    }
  };
  const buildAll = () => {
    setLanes(LANES.map((l) => ({ ...l, buffer: null })));
    LANES.forEach((l) => build(l.key));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Builds a ~60s song sketch — chord bed, drums that drop in after a 4-bar intro, and a riser into the drop. Preview it here, then send it to Audiotool. Uses credits for 2 Forge loops + 1 sound effect.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {VIBES.map((v) => (
          <button key={v.id} disabled={anyBusy} onClick={() => { setVibeId(v.id); setBpm(v.bpm); }}
            className={`rounded-xl border px-3 py-2 text-left transition-colors ${v.id === vibeId ? 'border-accent bg-accent/10' : 'border-border hover:border-foreground/30'}`}>
            <p className="text-sm font-semibold">{v.label}</p>
            <p className="text-[11px] text-muted-foreground">{v.bpm} BPM</p>
          </button>
        ))}
      </div>
      <div className="grid sm:grid-cols-[1fr_7rem] gap-2">
        <div>
          <label className="text-xs text-muted-foreground">Extra direction (optional)</label>
          <Input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="e.g. minor key, rainy, vintage" disabled={anyBusy} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">BPM</label>
          <Input type="number" min={60} max={190} value={bpm} onChange={(e) => setBpm(Number(e.target.value) || vibe.bpm)} disabled={anyBusy} />
        </div>
      </div>
      <Button className="merc-button" onClick={buildAll} disabled={anyBusy}>
        {anyBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
        {anyBusy ? 'Generating elements…' : `Build 60s "${vibe.label}" pre-starter`}
      </Button>

      <div className="space-y-2">
        {lanes.map((l) => (
          <PreStarterLane key={l.key} lane={l} mix={player.state(l.key)} total={total} busy={busy[l.key]}
            onUpdate={(p) => player.update(l.key, p)} onRegen={() => build(l.key)} />
        ))}
        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" onClick={player.playing ? player.stop : player.play} disabled={!lanes.some((l) => l.buffer)}>
            {player.playing ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {player.playing ? 'Stop' : 'Preview mix'}
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">{fmt(player.playing ? player.pos : 0)} / {fmt(total)}</span>
        </div>
      </div>

      <PreStarterSendBar session={session} lanes={lanes} gainOf={player.gainOf} bpm={bpm}
        title={`${vibe.label} pre-starter`} prompts={prompts} />
    </div>
  );
}