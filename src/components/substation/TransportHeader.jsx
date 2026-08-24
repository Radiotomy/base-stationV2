import { Play, Pause, Square, Circle, Repeat, Music2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import InfoTip from '@/components/common/InfoTip';
import TransportClock from './TransportClock';
import CpuMeter from './CpuMeter';

const iconBtn = 'h-8 w-8 rounded-lg grid place-items-center border transition-colors';

export default function TransportHeader({
  session, patch, playing, recording, engine,
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

      <TransportClock engine={engine} bpm={session.bpm} />

      <div className="flex items-center gap-2 min-w-[190px]">
        <span className="text-[9px] uppercase tracking-widest text-white/40 font-mono">BPM</span>
        <Slider value={[session.bpm]} min={60} max={180} step={1}
          onValueChange={([v]) => patch({ bpm: v })} className="flex-1" />
        <span className="text-xs font-mono text-white/80 w-8 tabular-nums">{session.bpm}</span>
        <InfoTip size="sm" side="bottom" text="Tempo drives the grid, the metronome and every bounce. Changing it re-times the whole arrangement." />
      </div>

      <CpuMeter />

      <div className="flex-1" />

      <Button onClick={onExport} className="h-8 text-xs font-bold"
        style={{ background: 'linear-gradient(135deg,#14b8a6,#0d9488)', color: '#04211d' }}>
        <Download className="w-3.5 h-3.5 mr-1.5" />
        Master Export
      </Button>
    </div>
  );
}