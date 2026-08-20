import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Activity, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import usePatchModulation from '@/hooks/usePatchModulation';

const MOD_TYPES = ['lfo', 'adsr'];
const hasModulators = (p) =>
  (p.graph_state?.nodes || []).some((n) => MOD_TYPES.includes(n.type));

/**
 * Picks one of the creator's Foundry patches and taps its LFO / envelope
 * movement as a modulation source for the visualizer.
 */
export default function PatchModulationTap({ bpm = 120, onLevel }) {
  const [patches, setPatches] = useState(null);
  const [pluginId, setPluginId] = useState('');
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    base44.auth.me()
      .then((me) => base44.entities.FoundryPlugin.filter({ user_id: me.id }, '-created_date', 40))
      .then((rows) => setPatches(rows.filter(hasModulators)))
      .catch(() => setPatches([]));
  }, []);

  const selected = (patches || []).find((p) => p.id === pluginId);
  const { taps, level } = usePatchModulation(selected?.graph_state, {
    bpm,
    active: enabled && !!selected,
  });

  useEffect(() => { onLevel?.(enabled ? level : 0); }, [level, enabled, onLevel]);

  return (
    <div className="space-y-3">
      {patches === null && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading patches…
        </div>
      )}

      {patches && !patches.length && (
        <p className="text-xs text-muted-foreground">
          None of your Foundry patches have an LFO or envelope yet — add one on the canvas
          and it will show up here as a modulation source.
        </p>
      )}

      {!!patches?.length && (
        <>
          <select
            value={pluginId}
            onChange={(e) => setPluginId(e.target.value)}
            className="w-full h-9 rounded-xl bg-muted/40 border border-border px-3 text-xs"
          >
            <option value="">No patch modulation</option>
            {patches.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>

          {selected && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-purple-400" /> Drive visuals
              </span>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
          )}

          {enabled && taps.map((t) => (
            <div key={t.nodeId} className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{t.label}</span>
                <span className="font-mono">{Math.round(t.value * 100)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-purple-500 transition-[width] duration-75"
                  style={{ width: `${Math.round(t.value * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}