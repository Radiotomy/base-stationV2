import { Play, Pause, Square, Circle, Repeat, Music2, Download, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import InfoTip from '@/components/common/InfoTip';
import { barsBeats, timecode } from '@/lib/substation/session';

const iconBtn = 'h-8 w-8 rounded-lg grid place-items-center border transition-colors';

export default function TransportHeader({
  session, patch, playing, recording, position, cpu,
  onPlay, onPause, onStop, onToggleRecord, onExport,
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-3 py-2 rounded-xl border border-white/10 bg-[#09090b]/80">
      <div className="flex items-center gap-1.5">
        <button onClick={playing ? onPause : onPlay} title={playing ? 'Pause' : 'Play'}
          className={`${iconBtn} ${playing ? 'border-[#14b8a6] text-[#14b8a6] bg-[#14b8a6]/10' : 'border-white/12 text-white/70 hover:text-white'}`}>
          {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>
        <button onClick={onStop} title="Stop" className={`${iconBtn} border-white/12 text-white/70 hover:text-white`}>
          <Square className="w-3.5 h-3.5" />
        </button>
        <button onClick={onToggleRecord} title="Record played notes onto the armed track"
          className={`${iconBtn} ${recording ? 'border-[#fb7185] text-[#fb7185] bg-[#fb7185]/10' : 'border-white/12 text-white/70 hover:text-white'}`}>
          <Circle className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => patch({ loop: { ...session.loop, enabled: !session.loop.enabled } })} title="Loop"
          className={`${iconBtn} ${session.loop.enabled ? 'border-[#f59e0b] text-[#f59e0b] bg-[#f59e0b]/10' : 'border-white/12 text-white/70 hover:text-white'}`}>
          <Repeat className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => patch({ metronome: !session.metronome })} title="Metronome"
          className={`${iconBtn} ${session.metronome ? 'border-[#14b8a6] text-[#14b8a6] bg-[#14b8a6]/10' : 'border-white/12 text-white/70 hover:text-white'}`}>
          <Music2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-3 px-3 py-1 rounded-lg bg-black/40 border border-white/8">
        <div>
          <p className="text-[8px] uppercase tracking-widest text-white/35 font-mono">Bars.Beats</p>
          <p className="text-sm font-mono text-[#14b8a6] tabular-nums">{barsBeats(position)}</p>
        </div>
        <div className="w-px h-7 bg-white/10" />
        <div>
          <p className="text-[8px] uppercase tracking-widest text-white/35 font-mono">Timecode</p>
          <p className="text-sm font-mono text-[#FF9A4D] tabular-nums">{timecode(position, session.bpm)}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 min-w-[190px]">
        <span className="text-[9px] uppercase tracking-widest text-white/40 font-mono">BPM</span>
        <Slider value={[session.bpm]} min={60} max={180} step={1}
          onValueChange={([v]) => patch({ bpm: v })} className="flex-1" />
        <span className="text-xs font-mono text-white/80 w-8 tabular-nums">{session.bpm}</span>
        <InfoTip size="sm" side="bottom" text="Tempo drives the grid, the metronome and every bounce. Changing it re-times the whole arrangement." />
      </div>

      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/40 border border-white/8">
        <Cpu className="w-3 h-3 text-white/40" />
        <div className="w-14 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full transition-all"
            style={{ width: `${Math.min(100, cpu)}%`, background: 'linear-gradient(90deg,#14b8a6,#f59e0b,#FF9A4D)' }} />
        </div>
        <span className="text-[9px] font-mono text-white/50 w-7 tabular-nums">{Math.round(cpu)}%</span>
      </div>

      <div className="flex-1" />

      <Button onClick={onExport} className="h-8 text-xs font-bold"
        style={{ background: 'linear-gradient(135deg,#14b8a6,#0d9488)', color: '#04211d' }}>
        <Download className="w-3.5 h-3.5 mr-1.5" />
        Master Export
      </Button>
    </div>
  );
}