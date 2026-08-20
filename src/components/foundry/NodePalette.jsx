import React from 'react';
import { Plus } from 'lucide-react';
import { NODE_DEFS, NODE_KINDS } from '@/lib/foundry/nodeTypes';

// Module drawer. Grouped by kind so the signal-flow mental model (make it,
// shape it, move it) is visible in the UI rather than something you memorize.
export default function NodePalette({ onAdd }) {
  const groups = Object.entries(NODE_KINDS).map(([kind, meta]) => ({
    kind,
    ...meta,
    types: Object.entries(NODE_DEFS).filter(([, d]) => d.kind === kind),
  }));

  return (
    <div className="flex items-start gap-4 overflow-x-auto pb-1">
      {groups.map((g) => (
        <div key={g.kind} className="shrink-0">
          <div className="text-[9px] uppercase tracking-widest mb-1.5" style={{ color: g.color }}>
            {g.label}
          </div>
          <div className="flex gap-1.5">
            {g.types.map(([type, def]) => (
              <button
                key={type}
                onClick={() => onAdd?.(type)}
                className="group flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] text-white/70 hover:text-white transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
                title={def.hint || def.label}
              >
                <Plus className="w-2.5 h-2.5 opacity-50 group-hover:opacity-100" />
                {def.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}