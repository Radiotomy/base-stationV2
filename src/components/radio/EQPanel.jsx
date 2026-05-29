import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { EQ_BANDS } from "@/hooks/useAudioProcessor";

const MIN_DB = -12;
const MAX_DB = 12;

/**
 * 5-band EQ with vertical sliders, Mercury chrome styling.
 * Each slider controls a BiquadFilter gain (in dB) via setBandGain.
 */
export default function EQPanel({ setBandGain }) {
  const [gains, setGains] = useState([0, 0, 0, 0, 0]);

  const update = (i, val) => {
    const v = Math.max(MIN_DB, Math.min(MAX_DB, val));
    setGains(prev => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
    setBandGain(i, v);
  };

  const reset = () => {
    setGains([0, 0, 0, 0, 0]);
    EQ_BANDS.forEach((_, i) => setBandGain(i, 0));
  };

  return (
    <div className="merc-card rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-baseline gap-2">
          <p className="text-white/80 text-xs font-bold tracking-widest uppercase">5-Band EQ</p>
          <span className="text-[10px] text-white/40">±12 dB</span>
        </div>
        <button onClick={reset}
          className="flex items-center gap-1 text-[10px] text-white/50 hover:text-white px-2 py-1 rounded-md hover:bg-white/5 transition-colors">
          <RotateCcw className="w-3 h-3" /> Flat
        </button>
      </div>

      <div className="flex items-end justify-between gap-3 px-1">
        {EQ_BANDS.map((band, i) => (
          <div key={band.freq} className="flex flex-col items-center gap-2 flex-1">
            {/* dB readout */}
            <span className={`text-[10px] font-mono tabular-nums ${gains[i] === 0 ? "text-white/40" : "text-white/80"}`}>
              {gains[i] > 0 ? "+" : ""}{gains[i].toFixed(0)}
            </span>

            {/* Vertical slider — native range rotated */}
            <div className="relative h-28 w-6 flex items-center justify-center">
              {/* Track guide with center mark */}
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 rounded-full bg-black/40 border border-white/10" />
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-white/15" />

              <input
                type="range"
                min={MIN_DB}
                max={MAX_DB}
                step={0.5}
                value={gains[i]}
                onChange={(e) => update(i, parseFloat(e.target.value))}
                className="merc-eq-slider absolute"
                style={{
                  transform: "rotate(-90deg)",
                  width: "112px",
                }}
                aria-label={`${band.label} Hz`}
              />
            </div>

            {/* Frequency label */}
            <span className="text-[10px] text-white/50 font-semibold">{band.label}</span>
          </div>
        ))}
      </div>

      {/* Slider styling */}
      <style>{`
        .merc-eq-slider {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          height: 24px;
          cursor: pointer;
        }
        .merc-eq-slider::-webkit-slider-runnable-track {
          height: 4px;
          background: transparent;
        }
        .merc-eq-slider::-moz-range-track {
          height: 4px;
          background: transparent;
        }
        .merc-eq-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 10px;
          border-radius: 3px;
          background: linear-gradient(135deg, #FFFFFF 0%, #E0E5EC 50%, #FFDDF0 100%);
          border: 1px solid rgba(255,255,255,0.4);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.8), 0 2px 6px rgba(0,0,0,0.5), 0 0 8px rgba(199,184,234,0.3);
          margin-top: -3px;
        }
        .merc-eq-slider::-moz-range-thumb {
          width: 18px;
          height: 10px;
          border-radius: 3px;
          background: linear-gradient(135deg, #FFFFFF 0%, #E0E5EC 50%, #FFDDF0 100%);
          border: 1px solid rgba(255,255,255,0.4);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.8), 0 2px 6px rgba(0,0,0,0.5);
        }
      `}</style>
    </div>
  );
}