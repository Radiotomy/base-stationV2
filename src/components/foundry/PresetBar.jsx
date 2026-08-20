import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Bookmark, Plus, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

// Preset strip. Presets store VALUES only — keys that no longer exist in the
// graph are skipped on load rather than recreated, so an old preset can never
// resurrect a module the creator deleted.
export default function PresetBar({ pluginId, graph, onApply }) {
  const [presets, setPresets] = useState([]);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = () => {
    if (!pluginId) return;
    base44.entities.FoundryPreset
      .filter({ plugin_id: pluginId }, '-created_date', 20)
      .then(setPresets)
      .catch(() => setPresets([]));
  };

  useEffect(load, [pluginId]);

  const save = async () => {
    if (!name.trim() || !pluginId) return;
    setSaving(true);
    try {
      const me = await base44.auth.me();
      const values = {};
      for (const n of graph.nodes || []) {
        for (const [k, v] of Object.entries(n.params || {})) values[`${n.id}.${k}`] = v;
      }
      await base44.entities.FoundryPreset.create({
        plugin_id: pluginId,
        user_id: me.id,
        name: name.trim(),
        parameter_values: values,
      });
      setName('');
      setAdding(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const apply = (preset) => {
    const nodes = (graph.nodes || []).map((n) => {
      const params = { ...n.params };
      for (const [key, value] of Object.entries(preset.parameter_values || {})) {
        const [nodeId, param] = key.split('.');
        if (nodeId === n.id && param in params) params[param] = value;
      }
      return { ...n, params };
    });
    onApply({ ...graph, nodes });
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Bookmark className="w-3 h-3 text-white/30 shrink-0" />
      {presets.map((p) => (
        <button
          key={p.id}
          onClick={() => apply(p)}
          className="px-2 py-1 rounded-md text-[10px] text-white/60 hover:text-[#FFC98A] bg-white/4 border border-white/8"
        >
          {p.name}
        </button>
      ))}
      {!presets.length && !adding && <span className="text-[10px] text-white/25">No presets</span>}

      {adding ? (
        <div className="flex items-center gap-1">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder="Preset name"
            className="h-6 w-28 text-[10px] bg-white/5 border-white/10"
          />
          <Button size="sm" onClick={save} disabled={saving} className="h-6 px-2 text-[10px] merc-button">
            {saving ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : 'Save'}
          </Button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="p-1 rounded-md text-white/30 hover:text-[#FF9A4D] bg-white/4 border border-white/8"
          title="Save current values as a preset"
        >
          <Plus className="w-2.5 h-2.5" />
        </button>
      )}
    </div>
  );
}