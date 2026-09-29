import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import InfoTip from '@/components/common/InfoTip';
import TIPS from '@/lib/audiotool/bridgeTips';

/** Starts a progression from one of the creator's own Lead Sheet scores. */
export default function LeadSheetChordImport({ onImport }) {
  const { user } = useAuth();
  const [sheets, setSheets] = useState([]);

  useEffect(() => {
    if (!user) return;
    base44.entities.LeadSheet.filter({ user_id: user.id }, '-updated_date', 20)
      .then((list) => setSheets(list.filter((s) => s.chord_chart)));
  }, [user]);

  if (!sheets.length) return null;
  return (
    <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
      <span className="flex items-center gap-1">Import from Lead Sheet <InfoTip text={TIPS.leadSheetImport} /></span>
      <select value="" onChange={(e) => { const s = sheets.find((x) => x.id === e.target.value); if (s) onImport(s.chord_chart); }}
        className="h-9 rounded-md border border-input bg-popover px-2 text-sm normal-case tracking-normal text-foreground">
        <option value="">Choose a score…</option>
        {sheets.map((s) => <option key={s.id} value={s.id}>{s.title}{s.key ? ` — ${s.key}` : ''}</option>)}
      </select>
    </label>
  );
}