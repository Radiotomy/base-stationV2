import React, { useCallback, useRef, useState } from 'react';
import CanvasNode, { NODE_W } from './CanvasNode';
import SignalCables from './SignalCables';
import { NODE_DEFS, modTargets, newId } from '@/lib/foundry/nodeTypes';

const NODE_H = 96;

// The patch surface. Wiring is a pointer gesture from an output port to an input
// port; when the source is a modulator the drop asks which parameter to target,
// because a modulator wired to "audio in" is silent and looks like a broken patch.
export default function NodeCanvas({ graph, selected, onSelect, onChange, onManualEdit }) {
  const hostRef = useRef(null);
  const [wiring, setWiring] = useState(null);
  const [modPick, setModPick] = useState(null);

  const nodes = graph?.nodes || [];
  const edges = graph?.edges || [];

  const toLocal = useCallback((e) => {
    const rect = hostRef.current?.getBoundingClientRect();
    return {
      x: e.clientX - (rect?.left || 0) + (hostRef.current?.scrollLeft || 0),
      y: e.clientY - (rect?.top || 0) + (hostRef.current?.scrollTop || 0),
    };
  }, []);

  const moveNode = (id, pos) => {
    onChange({ ...graph, nodes: nodes.map((n) => (n.id === id ? { ...n, ...pos } : n)) });
  };

  const deleteNode = (id) => {
    onChange({
      ...graph,
      nodes: nodes.filter((n) => n.id !== id),
      edges: edges.filter((e) => e.from !== id && e.to !== id),
    });
    onManualEdit?.('node');
  };

  const cutEdge = (edgeId) => {
    onChange({ ...graph, edges: edges.filter((e) => e.id !== edgeId) });
    onManualEdit?.('wire');
  };

  const commitEdge = (fromId, toId, toParam) => {
    if (fromId === toId) return;
    const dup = edges.some((e) => e.from === fromId && e.to === toId && (e.toParam || null) === (toParam || null));
    if (dup) return;
    onChange({ ...graph, edges: [...edges, { id: newId('e'), from: fromId, to: toId, ...(toParam ? { toParam } : {}) }] });
    onManualEdit?.('wire');
  };

  const onPortDown = (id) => {
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    setWiring({ fromId: id, from: { x: node.x + NODE_W, y: node.y + NODE_H / 2 }, to: { x: node.x + NODE_W, y: node.y + NODE_H / 2 } });
  };

  const onPortUp = (toId) => {
    if (!wiring) return;
    const src = nodes.find((n) => n.id === wiring.fromId);
    const dst = nodes.find((n) => n.id === toId);
    setWiring(null);
    if (!src || !dst) return;
    if (NODE_DEFS[src.type]?.isModulator) {
      const targets = modTargets(dst.type);
      if (!targets.length) return;
      setModPick({ fromId: src.id, toId, targets });
      return;
    }
    commitEdge(src.id, toId);
  };

  return (
    <div
      ref={hostRef}
      className="relative flex-1 overflow-auto"
      onPointerMove={(e) => wiring && setWiring((w) => ({ ...w, to: toLocal(e) }))}
      onPointerUp={() => setWiring(null)}
      onClick={(e) => { if (e.target === e.currentTarget) onSelect?.(null); }}
      style={{
        backgroundImage:
          'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)',
        backgroundSize: '22px 22px',
      }}
    >
      <div className="relative" style={{ minWidth: 1100, minHeight: 620 }}>
        <SignalCables
          nodes={nodes}
          edges={edges}
          pending={wiring ? { from: wiring.from, to: wiring.to } : null}
          onCut={cutEdge}
        />
        {nodes.map((node) => (
          <CanvasNode
            key={node.id}
            node={node}
            selected={selected === node.id}
            wiring={!!wiring && wiring.fromId !== node.id}
            onSelect={onSelect}
            onMove={moveNode}
            onDelete={deleteNode}
            onPortDown={onPortDown}
            onPortUp={onPortUp}
          />
        ))}

        {!nodes.length && (
          <div className="absolute inset-0 flex items-center justify-center text-center px-6">
            <p className="text-sm text-white/35 max-w-xs">
              Empty rack. Describe a sound on the left, or add modules from the drawer above.
            </p>
          </div>
        )}
      </div>

      {modPick && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="merc-card rounded-2xl p-4 w-64">
            <p className="text-xs text-white/60 mb-3">Modulate which parameter?</p>
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {modPick.targets.map((t) => (
                <button
                  key={t}
                  onClick={() => { commitEdge(modPick.fromId, modPick.toId, t); setModPick(null); }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs text-white/80 bg-white/5 hover:bg-white/10 border border-white/8"
                >
                  {t.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
            <button onClick={() => setModPick(null)} className="mt-3 w-full text-[11px] text-white/40 hover:text-white/70">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}