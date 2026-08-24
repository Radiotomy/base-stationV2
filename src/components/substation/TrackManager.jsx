import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import InfoTip from '@/components/common/InfoTip';
import TrackStrip from './TrackStrip';

const KINDS = [
  { id: 'synth', label: 'Synth / MIDI' },
  { id: 'audio', label: 'Audio / Sampler' },
  { id: 'aux', label: 'Aux Bus' },
];

export default function TrackManager({ tracks, selectedId, onSelect, onAdd, onPatch, onMove, onRemove }) {
  const [picking, setPicking] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-widest text-white/45 font-mono">Track Manager</span>
          <InfoTip size="sm" text="Unlimited lanes. Synth tracks play the keypad, Audio tracks host imported clips and stems, Aux buses collect sends." />
        </span>
        <Button size="sm" onClick={() => setPicking(v => !v)}
          className="h-6 px-2 text-[10px] font-bold"
          style={{ background: 'linear-gradient(135deg,#14b8a6,#0d9488)', color: '#04211d' }}>
          <Plus className="w-3 h-3 mr-1" />Add Track
        </Button>
      </div>

      {picking && (
        <div className="mb-2 rounded-lg border border-[#14b8a6]/30 bg-[#14b8a6]/5 p-1.5 space-y-1">
          {KINDS.map(k => (
            <button key={k.id}
              onClick={() => { onAdd(k.id); setPicking(false); }}
              className="w-full text-left px-2 py-1 rounded text-[11px] text-white/70 hover:bg-white/8 hover:text-white">
              {k.label}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        {tracks.map((t, i) => (
          <TrackStrip
            key={t.id}
            track={t}
            index={i}
            total={tracks.length}
            selected={t.id === selectedId}
            onSelect={() => onSelect(t.id)}
            onPatch={(p) => onPatch(t.id, p)}
            onMove={(dir) => onMove(t.id, dir)}
            onRemove={() => onRemove(t.id)}
          />
        ))}
      </div>
    </div>
  );
}