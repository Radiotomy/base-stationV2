import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import RotaryKnob from './RotaryKnob';
import { NODE_DEFS } from '@/lib/foundry/nodeTypes';

// Editor for the selected module. Continuous values get knobs (fast, tactile,
// what a plugin actually looks like); the rest get the control that fits the type.
export default function ParameterPanel({ node, onParamChange }) {
  if (!node) {
    return (
      <div className="px-3 py-6 text-center text-xs text-white/35">
        Select a module on the canvas to edit its parameters.
      </div>
    );
  }
  const def = NODE_DEFS[node.type];
  if (!def) return null;

  const entries = Object.entries(def.params);
  const knobs = entries.filter(([, p]) => p.type === 'number');
  const others = entries.filter(([, p]) => p.type !== 'number');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-white/80">{def.label}</span>
        <span className="text-[9px] font-mono text-white/30">{node.id}</span>
      </div>

      {!entries.length && (
        <p className="text-[11px] text-white/40 leading-snug">{def.hint || 'This module has no parameters.'}</p>
      )}

      {knobs.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {knobs.map(([key, p]) => (
            <RotaryKnob
              key={key}
              label={key.replace(/_/g, ' ')}
              value={Number(node.params?.[key] ?? p.default)}
              min={p.min}
              max={p.max}
              step={p.step}
              unit={p.unit}
              onChange={(v) => onParamChange(node.id, key, v)}
            />
          ))}
        </div>
      )}

      {others.map(([key, p]) => (
        <div key={key} className="space-y-1.5">
          <span className="text-[9px] uppercase tracking-widest text-white/40">{key.replace(/_/g, ' ')}</span>
          {p.type === 'enum' && (
            <Select
              value={String(node.params?.[key] ?? p.default)}
              onValueChange={(v) => onParamChange(node.id, key, v)}
            >
              <SelectTrigger className="h-8 text-xs bg-white/5 border-white/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {p.options.map((o) => (
                  <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {p.type === 'bool' && (
            <Switch
              checked={node.params?.[key] !== false}
              onCheckedChange={(v) => onParamChange(node.id, key, v)}
            />
          )}
          {p.type === 'text' && (
            <Input
              value={node.params?.[key] || ''}
              onChange={(e) => onParamChange(node.id, key, e.target.value)}
              placeholder="https://…"
              className="h-8 text-xs bg-white/5 border-white/10"
            />
          )}
        </div>
      ))}

      {/* A fine-adjust slider for the first knob — knobs are fast, sliders are precise. */}
      {knobs.length > 0 && (
        <div className="pt-1 space-y-1.5">
          <span className="text-[9px] uppercase tracking-widest text-white/40">
            Fine · {knobs[0][0].replace(/_/g, ' ')}
          </span>
          <Slider
            value={[Number(node.params?.[knobs[0][0]] ?? knobs[0][1].default)]}
            min={knobs[0][1].min}
            max={knobs[0][1].max}
            step={knobs[0][1].step}
            onValueChange={([v]) => onParamChange(node.id, knobs[0][0], v)}
          />
        </div>
      )}
    </div>
  );
}