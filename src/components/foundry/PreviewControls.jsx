import React from 'react';
import { Play, Square, Mic, MicOff, Power, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LevelMeter from './LevelMeter';

// Audition transport. Loop / Mic / Bypass are the three things you need to judge
// a plugin: is it doing something, on real input, and better than nothing.
export default function PreviewControls({
  engine, running, bypassed, micOn, bpm,
  onToggleRun, onToggleMic, onToggleBypass, onTrigger, onBpmChange,
}) {
  return (
    <div
      className="rounded-xl p-3 space-y-3"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={onToggleRun}
          className={`h-8 px-3 text-xs ${running ? 'merc-button-dark' : 'merc-button'}`}
        >
          {running ? <Square className="w-3 h-3 mr-1.5" /> : <Play className="w-3 h-3 mr-1.5" />}
          {running ? 'Stop' : 'Loop'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onToggleMic}
          className={`h-8 px-3 text-xs border-white/12 ${micOn ? 'text-[#FF6B4A]' : 'text-white/60'}`}
        >
          {micOn ? <MicOff className="w-3 h-3 mr-1.5" /> : <Mic className="w-3 h-3 mr-1.5" />}
          Mic
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onToggleBypass}
          className={`h-8 px-3 text-xs border-white/12 ${bypassed ? 'text-[#FFC98A]' : 'text-white/60'}`}
        >
          <Power className="w-3 h-3 mr-1.5" />
          {bypassed ? 'Bypassed' : 'Active'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onTrigger}
          className="h-8 px-2 text-xs text-white/50 hover:text-[#FFC98A]"
          title="Trigger ADSR envelopes"
        >
          <Zap className="w-3 h-3" />
        </Button>
      </div>

      <LevelMeter engine={engine} />

      <div className="flex items-center gap-2">
        <span className="text-[9px] uppercase tracking-widest text-white/40 shrink-0">Tempo</span>
        <input
          type="range"
          min={60}
          max={200}
          value={bpm}
          onChange={(e) => onBpmChange(Number(e.target.value))}
          className="flex-1 accent-[#FF9A4D]"
        />
        <span className="text-[10px] font-mono text-[#FFC98A] w-14 text-right">{bpm} BPM</span>
      </div>
    </div>
  );
}