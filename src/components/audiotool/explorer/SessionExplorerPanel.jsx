import { useEffect, useMemo, useRef, useState } from 'react';
import { copyBridgeLink } from '@/lib/audiotool/deepLinks';
import { toast } from 'sonner';
import { ListTree } from 'lucide-react';
import { readSession, setField } from '@/lib/audiotool/sessionExplorer';
import ExplorerTrackRow from './ExplorerTrackRow';
import ExplorerDeviceRow from './ExplorerDeviceRow';

export default function SessionExplorerPanel({ nexus, projectUrl, focus, version, connected, onChanged }) {
  const [busy, setBusy] = useState(false);
  const { tracks, devices } = useMemo(() => readSession(nexus), [nexus, version]);
  const scrolled = useRef(false);

  // Bring a deep-linked track or device into view once it has synced in.
  useEffect(() => {
    if (!focus || scrolled.current) return;
    const el = document.getElementById(`nexus-${focus}`);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); scrolled.current = true; }
  }, [focus, tracks, devices]);

  const copyLink = async (id) => {
    await copyBridgeLink(projectUrl, id);
    toast.success('Link copied — it opens this project right here');
  };
  const rowProps = (id) => ({ highlighted: id === focus, onCopyLink: () => copyLink(id) });

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
        <p className="text-sm text-muted-foreground">Everything in this project, updated live. Switch tracks and devices on or off without leaving BASE Station, or copy a link straight to any of them.</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tracks ({tracks.length})</h4>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {tracks.length === 0 && <p className="text-sm text-muted-foreground">No tracks yet.</p>}
            {tracks.map((t) => <ExplorerTrackRow key={t.id} track={t} disabled={disabled} onToggle={toggle} {...rowProps(t.id)} />)}
          </div>
        </div>
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Instruments & effects ({devices.length})</h4>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {devices.length === 0 && <p className="text-sm text-muted-foreground">No synths or effects on the desktop yet.</p>}
            {devices.map((d) => <ExplorerDeviceRow key={d.id} device={d} disabled={disabled} onToggle={toggle} {...rowProps(d.id)} />)}
          </div>
        </div>
      </div>
    </section>
  );
}