import { Plus, Trash2, Check, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import InfoTip from '@/components/common/InfoTip';
import { uid } from '@/lib/substation/session';

const ROLES = ['Writer', 'Composer', 'Producer', 'Performer', 'Engineer', 'Publisher'];

export default function SplitSheet({ splits, onChange }) {
  const total = splits.reduce((s, r) => s + (Number(r.pct) || 0), 0);
  const valid = Math.abs(total - 100) < 0.01;

  const patch = (id, p) => onChange(splits.map(r => (r.id === id ? { ...r, ...p } : r)));
  const add = () => onChange([...splits, { id: uid('sp'), name: '', role: 'Writer', pct: 0 }]);
  const remove = (id) => onChange(splits.filter(r => r.id !== id));
  const even = () => {
    const each = Math.floor((100 / splits.length) * 100) / 100;
    onChange(splits.map((r, i) => ({
      ...r,
      pct: i === splits.length - 1 ? Math.round((100 - each * (splits.length - 1)) * 100) / 100 : each,
    })));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-mono uppercase tracking-widest text-[#FF9A4D]">Split Sheet</span>
        <InfoTip size="sm" text="Ownership shares for this arrangement. The export is blocked until the shares total exactly 100% — a manifest that doesn't balance can't be ingested." />
      </div>

      <div className="space-y-1.5">
        {splits.map((r) => (
          <div key={r.id} className="flex items-center gap-1.5">
            <Input value={r.name} placeholder="Collaborator name"
              onChange={(e) => patch(r.id, { name: e.target.value })}
              className="h-7 text-[11px] bg-black/40 border-white/10 flex-1" />
            <select value={r.role} onChange={(e) => patch(r.id, { role: e.target.value })}
              className="h-7 bg-black/40 border border-white/10 rounded text-[10px] font-mono text-white/70 px-1 outline-none">
              {ROLES.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
            <Input type="number" value={r.pct}
              onChange={(e) => patch(r.id, { pct: Number(e.target.value) })}
              className="h-7 w-16 text-[11px] font-mono bg-black/40 border-white/10 text-right" />
            <span className="text-[10px] font-mono text-white/40">%</span>
            <button onClick={() => remove(r.id)} disabled={splits.length === 1}
              className="text-white/25 hover:text-[#fb7185] disabled:opacity-20">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button onClick={add} className="h-6 px-2 rounded border border-white/12 text-[10px] text-white/60 hover:text-white flex items-center gap-1">
          <Plus className="w-2.5 h-2.5" /> Collaborator
        </button>
        <button onClick={even} className="h-6 px-2 rounded border border-white/12 text-[10px] text-white/60 hover:text-white">
          Split evenly
        </button>
      </div>

      <div className={`rounded-lg border p-2 flex items-center gap-2 ${
        valid ? 'border-[#14b8a6]/40 bg-[#14b8a6]/8' : 'border-[#f59e0b]/40 bg-[#f59e0b]/8'
      }`}>
        {valid
          ? <Check className="w-3.5 h-3.5 text-[#14b8a6]" />
          : <AlertTriangle className="w-3.5 h-3.5 text-[#f59e0b]" />}
        <span className="text-[11px] font-mono flex-1" style={{ color: valid ? '#14b8a6' : '#f59e0b' }}>
          Total {total.toFixed(2)}%
        </span>
        <span className="text-[10px] text-white/45">
          {valid ? 'Balanced — ready for handoff' : `${(100 - total).toFixed(2)}% remaining`}
        </span>
      </div>
    </div>
  );
}