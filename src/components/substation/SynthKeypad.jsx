import { useState } from 'react';

const WHITE = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24];
const BLACK = { 1: 0, 3: 1, 6: 3, 8: 4, 10: 5, 13: 7, 15: 8, 18: 10, 20: 11, 22: 12 };
const ROOT = 48;

// Playable keypad. Notes are routed to the selected track's strip so the mixer
// and FX rack apply to live playing exactly as they do to the arrangement.
export default function SynthKeypad({ engine, trackId, onNote }) {
  const [held, setHeld] = useState([]);

  const down = (midi) => {
    engine.noteOn(midi, trackId);
    setHeld(h => [...h, midi]);
    onNote?.(midi);
  };
  const up = (midi) => {
    engine.noteOff(midi);
    setHeld(h => h.filter(m => m !== midi));
  };

  return (
    <div className="rounded-lg border border-white/10 bg-[#09090b] p-2">
      <p className="text-[9px] font-mono uppercase tracking-widest text-white/35 mb-1.5">
        Synth Keypad · routed to selected track
      </p>
      <div className="relative h-24 select-none" style={{ touchAction: 'none' }}>
        <div className="flex h-full gap-[2px]">
          {WHITE.map((off) => {
            const midi = ROOT + off;
            const on = held.includes(midi);
            return (
              <button key={midi}
                onPointerDown={() => down(midi)}
                onPointerUp={() => up(midi)}
                onPointerLeave={() => on && up(midi)}
                className={`flex-1 rounded-b transition-colors ${on ? 'bg-[#14b8a6]' : 'bg-white/85 hover:bg-white'}`}
              />
            );
          })}
        </div>
        <div className="absolute inset-0 pointer-events-none">
          {Object.entries(BLACK).map(([off, whiteIdx]) => {
            const midi = ROOT + Number(off);
            const on = held.includes(midi);
            const pct = ((Number(whiteIdx) + 1) / WHITE.length) * 100;
            return (
              <button key={midi}
                onPointerDown={() => down(midi)}
                onPointerUp={() => up(midi)}
                onPointerLeave={() => on && up(midi)}
                className={`absolute top-0 h-[60%] w-[3.2%] rounded-b pointer-events-auto ${on ? 'bg-[#0d9488]' : 'bg-[#18181b] hover:bg-[#27272a]'}`}
                style={{ left: `calc(${pct}% - 1.6%)` }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}