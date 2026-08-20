import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { SlidersHorizontal, Loader2 } from 'lucide-react';
import { isInsertable } from '@/lib/foundry/foundryInsert';

// Named voice chains = the creator's own Foundry UTILITY patches that audio can
// pass through. Category is the filter rather than the title, so a chain has to
// be deliberately built as a utility to show up as one here.
export default function VoiceChainPicker({ selected, onSelect, disabled }) {
  const [chains, setChains] = useState(null);

  useEffect(() => {
    (async () => {
      const me = await base44.auth.me();
      const rows = await base44.entities.FoundryPlugin.filter(
        { user_id: me.id, category: 'utility' }, '-updated_date', 30,
      );
      setChains(rows.filter((p) => isInsertable(p.graph_state)));
    })().catch(() => setChains([]));
  }, []);

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold text-white/70 flex items-center gap-1.5">
        <SlidersHorizontal className="w-3 h-3 text-[#FF9A4D]" /> Voice Chain
      </p>

      {chains === null && (
        <p className="text-[11px] text-white/40 flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" /> Loading chains…
        </p>
      )}

      {chains?.length === 0 && (
        <p className="text-[11px] text-white/40">
          No voice chains yet — build a <strong className="text-white/60">utility</strong> patch with an
          Insert Input and an Output in{' '}
          <Link to="/foundry" className="text-[#FFC98A] underline">BASE Foundry</Link>.
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {(chains || []).map((c) => {
          const active = selected?.id === c.id;
          return (
            <button
              key={c.id}
              disabled={disabled}
              onClick={() => onSelect(active ? null : c)}
              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-colors disabled:opacity-50 ${
                active
                  ? 'border-[#FF9A4D] bg-[#FF9A4D]/15 text-white'
                  : 'border-white/10 bg-white/5 text-white/70 hover:border-[#FF9A4D]/40'
              }`}
            >
              {c.title}
            </button>
          );
        })}
      </div>
    </div>
  );
}