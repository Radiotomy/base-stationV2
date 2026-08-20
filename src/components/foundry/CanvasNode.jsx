import React, { useRef } from 'react';
import { X, Zap } from 'lucide-react';
import { NODE_DEFS, NODE_KINDS } from '@/lib/foundry/nodeTypes';

export const NODE_W = 176;

// One module on the canvas. Ports are absolutely positioned so the cable layer
// can compute anchor points from node coords alone, with no DOM measuring.
export default function CanvasNode({
  node, selected, onSelect, onMove, onDelete,
  onPortDown, onPortUp, wiring,
}) {
  const def = NODE_DEFS[node.type];
  const drag = useRef(null);
  if (!def) return null;

  const accent = NODE_KINDS[def.kind]?.color || '#FF9A4D';
  const isMod = !!def.isModulator;

  const onPointerDown = (e) => {
    if (e.target.closest('[data-port]') || e.target.closest('[data-nodrag]')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: node.x, oy: node.y };
    onSelect?.(node.id);
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    onMove?.(node.id, {
      x: Math.max(0, drag.current.ox + (e.clientX - drag.current.x)),
      y: Math.max(0, drag.current.oy + (e.clientY - drag.current.y)),
    });
  };
  const onPointerUp = () => { drag.current = null; };

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="absolute rounded-xl touch-none cursor-grab active:cursor-grabbing"
      style={{
        left: node.x,
        top: node.y,
        width: NODE_W,
        background: 'linear-gradient(145deg, rgba(40,31,22,0.92) 0%, rgba(22,17,12,0.96) 100%)',
        border: `1px solid ${selected ? accent : 'rgba(255,255,255,0.10)'}`,
        boxShadow: selected
          ? `0 0 0 1px ${accent}55, 0 10px 30px -6px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.10)`
          : 'inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 22px -8px rgba(0,0,0,0.6)',
      }}
    >
      <div className="flex items-center gap-2 px-2.5 py-2 border-b border-white/8">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
        <span className="text-[11px] font-semibold text-white/85 truncate flex-1">{def.label}</span>
        {isMod && <Zap className="w-3 h-3 shrink-0" style={{ color: accent }} />}
        <button
          data-nodrag
          onClick={() => onDelete?.(node.id)}
          className="text-white/25 hover:text-[#FF6B4A] shrink-0"
          aria-label="Delete module"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      <div className="px-2.5 py-2 space-y-0.5">
        {Object.entries(def.params).slice(0, 3).map(([key, p]) => (
          <div key={key} className="flex items-center justify-between gap-2">
            <span className="text-[9px] uppercase tracking-wide text-white/35 truncate">{key.replace(/_/g, ' ')}</span>
            <span className="text-[10px] font-mono text-[#FFC98A] shrink-0">
              {String(node.params?.[key] ?? p.default).slice(0, 8)}{p.unit ? p.unit : ''}
            </span>
          </div>
        ))}
        {Object.keys(def.params).length === 0 && (
          <div className="text-[9px] text-white/30 leading-snug">{def.hint || 'No parameters'}</div>
        )}
      </div>

      {def.audioIn && (
        <div
          data-port
          onPointerUp={() => onPortUp?.(node.id)}
          className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 cursor-crosshair"
          style={{
            background: wiring ? '#FF9A4D' : '#14100C',
            borderColor: wiring ? '#FFC98A' : 'rgba(255,255,255,0.3)',
            boxShadow: wiring ? '0 0 10px #FF9A4D' : 'none',
          }}
          title="Signal in"
        />
      )}
      {def.audioOut && (
        <div
          data-port
          onPointerDown={(e) => { e.stopPropagation(); onPortDown?.(node.id); }}
          className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 cursor-crosshair"
          style={{ background: accent, borderColor: 'rgba(255,255,255,0.45)', boxShadow: `0 0 8px ${accent}88` }}
          title={isMod ? 'Modulation out' : 'Signal out'}
        />
      )}
    </div>
  );
}