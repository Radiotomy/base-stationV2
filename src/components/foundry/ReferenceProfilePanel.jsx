import React, { useRef, useState } from 'react';
import { Waves, Loader2, X, Upload } from 'lucide-react';
import { profileReferenceFile, describeProfile } from '@/lib/foundry/referenceProfile';

// Reference-to-patch. The file is decoded in the browser and never uploaded —
// what reaches the architect is a tonal DESCRIPTION (band balance, brightness,
// dynamics, width), which is a target to match, not a copy of the reference.
export default function ReferenceProfilePanel({ reference, onChange, disabled }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const profile = await profileReferenceFile(file);
      onChange({ name: file.name, profile });
    } catch (err) {
      setError('That file could not be decoded for analysis.');
    }
    setBusy(false);
  };

  return (
    <div className="rounded-xl border border-white/8 bg-white/4 p-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-widest text-white/50 flex items-center gap-1.5">
          <Waves className="w-3 h-3 text-[#FF9A4D]" /> Reference
        </span>
        {reference && !disabled && (
          <button onClick={() => onChange(null)} className="text-white/40 hover:text-white">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {!reference && (
        <>
          <p className="text-[10px] text-white/40 leading-relaxed">
            Analyse a track you love, then ask the architect to match its tonal balance.
            Stays on your device — only the tone profile is sent.
          </p>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy || disabled}
            className="w-full flex items-center justify-center gap-1.5 text-[11px] font-bold px-2 py-1.5 rounded-lg border border-white/10 bg-white/5 text-white/70 hover:border-[#FF9A4D]/40 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            {busy ? 'Analysing…' : 'Analyse a reference'}
          </button>
        </>
      )}

      {error && <p className="text-[10px] text-[#FF9A8A]">{error}</p>}

      {reference && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-bold text-white truncate">{reference.name}</p>
          <p className="text-[10px] text-[#FFC98A]">{describeProfile(reference.profile)}</p>
          <div className="grid grid-cols-7 gap-1 pt-0.5">
            {reference.profile.bands.map((b) => {
              // -30 dB floor → a full-height bar is the loudest band.
              const h = Math.max(4, Math.round(((b.relative_db + 30) / 30) * 34));
              return (
                <div key={b.key} className="flex flex-col items-center gap-1" title={`${b.label} ${b.range_hz}Hz · ${b.relative_db} dB`}>
                  <div className="h-[34px] w-full flex items-end">
                    <div className="w-full rounded-sm bg-gradient-to-t from-[#FF6B4A] to-[#FFC98A]" style={{ height: `${h}px` }} />
                  </div>
                  <span className="text-[7px] text-white/35">{b.label.slice(0, 3)}</span>
                </div>
              );
            })}
          </div>
          <p className="text-[9px] font-mono text-white/30">
            ~{reference.profile.approx_centroid_hz} Hz · crest {reference.profile.crest_factor_db} dB · width {reference.profile.stereo_width}
          </p>
        </div>
      )}

      <input ref={fileRef} type="file" accept="audio/*" onChange={pick} className="hidden" />
    </div>
  );
}