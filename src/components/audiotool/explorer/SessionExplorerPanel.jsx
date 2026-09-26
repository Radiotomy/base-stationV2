import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ListTree } from 'lucide-react';
import { readSession, setField } from '@/lib/audiotool/sessionExplorer';
import ExplorerTrackRow from './ExplorerTrackRow';
import ExplorerDeviceRow from './ExplorerDeviceRow';

export default function SessionExplorerPanel({ nexus, version, connected, onChanged }) {
  const [busy, setBusy] = useState(false);
  const { tracks, devices } = useMemo(() => readSession(nexus), [nexus, version]);

  const toggle = async (field, value) => {
    setBusy(true);
    try {
      await setField(nexus, field, value);
      onChanged?.();
    } catch (e) {
      toast.error(`Audiotool rejected the change — ${e.message}`);
    }
    setBusy(false);
  };
  const disabled = busy || !connected;

  return (
    <section className="rounded-2xl border border-border p-5 space-y-4">
      <div>
        <h3 className="font-bold flex items-center gap-2"><ListTree className="w-4 h-4" /> Session Explorer</h3>
        <p className="text-sm text-muted-foreground">Everything in this project, updated live. Switch tracks and devices on or off without leaving BASE Station.</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tracks ({tracks.length})</h4>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {tracks.length === 0 && <p className="text-sm text-muted-foreground">No tracks yet.</p>}
            {tracks.map((t) => <ExplorerTrackRow key={t.id} track={t} disabled={disabled} onToggle={toggle} />)}
          </div>
        </div>
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Instruments & effects ({devices.length})</h4>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {devices.length === 0 && <p className="text-sm text-muted-foreground">No synths or effects on the desktop yet.</p>}
            {devices.map((d) => <ExplorerDeviceRow key={d.id} device={d} disabled={disabled} onToggle={toggle} />)}
          </div>
        </div>
      </div>
    </section>
  );
}