import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { runForgeLoop, errorText } from '@/lib/audiotool/songstarterGen';

// Arrangement roles mapped to Forge categories, so each render drops onto the
// timeline as one clean, single-purpose layer (the way Audiotool tracks are built).
const ROLES = [
  { id: 'drums', label: 'Drums', category: 'drum_loop', hint: 'tight punchy drum groove' },
  { id: 'bass', label: 'Bass', category: 'bass_loop', hint: 'deep sub bassline' },
  { id: 'keys', label: 'Chords', category: 'melodic_loop', hint: 'warm chord stabs, no drums' },
  { id: 'lead', label: 'Melody', category: 'melodic_loop', hint: 'catchy lead melody, no drums' },
  { id: 'texture', label: 'Texture', category: 'loop', hint: 'atmospheric pad texture' },
  { id: 'hit', label: 'One-shot', category: 'one_shot', hint: 'single punchy hit' },
];
const BARS = [1, 2, 4, 8];

/** BASE Forge for SUB-Station — bar-locked, tempo-matched layers. Calls onReady(asset). */
export default function ForgePanel({ bpm = 120, onReady }) {
  const [role, setRole] = useState(ROLES[0]);
  const [prompt, setPrompt] = useState('');
  const [keySig, setKeySig] = useState('');
  const [bars, setBars] = useState(4);
  const [busy, setBusy] = useState(false);

  // Forge caps at 30s; pick the most bars that fit at this tempo.
  const barSec = (4 * 60) / bpm;
  const fitBars = Math.max(1, Math.min(bars, Math.floor(30 / barSec)));
  const seconds = role.category === 'one_shot' ? 2 : Math.max(1, Math.round(fitBars * barSec));

  const go = async () => {
    setBusy(true);
    try {
      const text = [prompt.trim() || role.hint, keySig && role.id !== 'drums' ? `in ${keySig}` : '', `${bpm} BPM`].filter(Boolean).join(', ');
      const out = await runForgeLoop({ prompt: text, category: role.category, bpm, duration: seconds });
      const title = `Forge ${role.label} — ${text.slice(0, 36)}`;
      toast.success(`${role.label} layer ready`);
      onReady?.({ title, file_url: out.audioUrl });
    } catch (e) {
      toast.error(errorText(e));
    }
    setBusy(false);
  };

  const field = 'h-8 text-xs bg-black/40 border-white/10';
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1">
        {ROLES.map((r) => (
          <button key={r.id} onClick={() => setRole(r)} disabled={busy}
            className={`h-7 rounded text-[11px] border ${role.id === r.id ? 'border-accent text-accent bg-white/5' : 'border-white/10 text-white/60'}`}>
            {r.label}
          </button>
        ))}
      </div>
      <Input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={role.hint} className={field} disabled={busy} />
      <div className="flex gap-1.5">
        <Input value={keySig} onChange={(e) => setKeySig(e.target.value)} placeholder="Key (A minor)" className={field} disabled={busy || role.id === 'drums'} />
        {role.category !== 'one_shot' && BARS.map((b) => (
          <button key={b} onClick={() => setBars(b)} disabled={busy}
            className={`h-8 w-8 shrink-0 rounded text-[11px] border ${bars === b ? 'border-accent text-accent' : 'border-white/10 text-white/60'}`}>
            {b}
          </button>
        ))}
      </div>
      <Button size="sm" variant="outline" onClick={go} disabled={busy} className="w-full gap-2">
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
        {busy ? 'Forging…' : `Forge ${role.label.toLowerCase()} · ${role.category === 'one_shot' ? 'hit' : `${fitBars} bar${fitBars > 1 ? 's' : ''}`} @ ${bpm}`}
      </Button>
      <p className="text-[10px] text-muted-foreground">2 credits · bar-locked WAV at session tempo · commercial-ready. Saved to your library, so it can also be sent to Audiotool from the Bridge.</p>
    </div>
  );
}