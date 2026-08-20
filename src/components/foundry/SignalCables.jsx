import React from 'react';
import { NODE_DEFS } from '@/lib/foundry/nodeTypes';
import { NODE_W } from './CanvasNode';

const NODE_H = 96; // visual height used for port anchoring

function anchors(node) {
  return {
    out: { x: node.x + NODE_W, y: node.y + NODE_H / 2 },
    in: { x: node.x, y: node.y + NODE_H / 2 },
  };
}

function bezier(a, b) {
  const dx = Math.max(50, Math.abs(b.x - a.x) * 0.5);
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}

// Animated bezier signal cables. Modulation cables are visually distinct from
// audio cables — confusing the two is the single easiest way to misread a patch.
export default function SignalCables({ nodes, edges, pending, onCut }) {
  const byId = new Map(nodes.map((n) => [n.id, n]));

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="foundry-audio" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FF9A4D" />
          <stop offset="100%" stopColor="#FFC98A" />
        </linearGradient>
        <linearGradient id="foundry-mod" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FF6B4A" />
          <stop offset="100%" stopColor="#FF9A4D" />
        </linearGradient>
      </defs>

      {edges.map((edge) => {
        const from = byId.get(edge.from);
        const to = byId.get(edge.to);
        if (!from || !to) return null;
        const a = anchors(from).out;
        const b = anchors(to).in;
        const isMod = !!edge.toParam || NODE_DEFS[from.type]?.isModulator;
        const d = bezier(a, b);
        return (
          <g key={edge.id}>
            <path d={d} stroke={isMod ? 'url(#foundry-mod)' : 'url(#foundry-audio)'} strokeWidth="2" fill="none" opacity="0.75" />
            <path
              d={d}
              stroke={isMod ? '#FFD9A8' : '#FFFFFF'}
              strokeWidth="1.5"
              fill="none"
              opacity="0.9"
              strokeDasharray={isMod ? '2 12' : '4 14'}
              style={{ animation: 'foundry-flow 1.1s linear infinite' }}
            />
            <path
              d={d}
              stroke="transparent"
              strokeWidth="14"
              fill="none"
              className="pointer-events-auto cursor-pointer"
              onClick={() => onCut?.(edge.id)}
            />
            {edge.toParam && (
              <text
                x={(a.x + b.x) / 2}
                y={(a.y + b.y) / 2 - 8}
                textAnchor="middle"
                className="pointer-events-none"
                fill="#FFD9A8"
                fontSize="9"
                fontFamily="monospace"
              >
                → {edge.toParam}
              </text>
            )}
          </g>
        );
      })}

      {pending && (
        <path
          d={bezier(pending.from, pending.to)}
          stroke="#FFC98A"
          strokeWidth="2"
          strokeDasharray="5 6"
          fill="none"
          opacity="0.8"
        />
      )}

      <style>{`@keyframes foundry-flow { to { stroke-dashoffset: -18; } }`}</style>
    </svg>
  );
}