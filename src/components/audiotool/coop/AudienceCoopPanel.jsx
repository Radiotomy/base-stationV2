import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import useVenueCoop from '@/hooks/useVenueCoop';
import CoopLogRow from './CoopLogRow';
import InfoTip from '@/components/common/InfoTip';
import TIPS from '@/lib/audiotool/bridgeTips';

const KINDS = [['sfx', 'Sound FX (ElevenLabs)'], ['loop', 'Loops (BASE Forge)'], ['midi', 'MIDI patterns']];

export default function AudienceCoopPanel({ at, nexus, projectUrl, onChanged }) {
  const [venues, setVenues] = useState(null);
  const [venueId, setVenueId] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [bpm, setBpm] = useState('120');
  const [allow, setAllow] = useState({ sfx: true, loop: true, midi: true });
  const { status, log } = useVenueCoop({
    enabled, venueId, session: { at, nexus, projectUrl, bpm: Number(bpm) || 120, allow, onChanged },
  });

  useEffect(() => {
    base44.auth.me().then((me) => base44.entities.PortalVenue.filter({ user_id: me.id }, '-updated_date', 50)).then(setVenues);
  }, []);

  return (
    <section className="rounded-2xl border border-border p-5 space-y-4">
      <div>
        <h3 className="font-bold flex items-center gap-2"><Users className="w-4 h-4" /> Audience Co-Op <InfoTip text={TIPS.coop} size="sm" side="bottom" /></h3>
        <p className="text-sm text-muted-foreground">
          Let your venue audience type <code>/generate sfx …</code>, <code>/generate loop …</code> or <code>/generate midi …</code> in the venue chat.
          Requests run one at a time on your credits and land after the end of your timeline, so playback keeps going.
        </p>
      </div>
      <div className="grid sm:grid-cols-[1fr_120px] gap-3">
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Venue</span>
          <select value={venueId} onChange={(e) => { setVenueId(e.target.value); setEnabled(false); }} disabled={!venues}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground">
            <option value="">{!venues ? 'Loading venues…' : venues.length ? 'Choose a venue' : 'No venues yet — create one in Live Venues'}</option>
            {(venues || []).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">Loop tempo (BPM) <InfoTip text={TIPS.coopBpm} /></span>
          <Input type="number" value={bpm} onChange={(e) => setBpm(e.target.value)} />
        </label>
      </div>
      <div className="flex flex-wrap gap-4">
        {KINDS.map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 text-sm">
            <Switch checked={allow[k]} onCheckedChange={(v) => setAllow((a) => ({ ...a, [k]: v }))} /> {label}
          </label>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <Switch checked={enabled} disabled={!venueId} onCheckedChange={setEnabled} /> Accept audience commands <InfoTip text={TIPS.coopAccept} />
      </label>
      {status === 'listening' && <p className="text-xs text-emerald-300">● Listening to venue chat</p>}
      {status === 'blocked' && <p className="text-xs text-destructive">Another Bridge tab is already handling this venue's commands.</p>}
      {log.length > 0 && <div className="space-y-1.5">{log.map((e) => <CoopLogRow key={e.id} entry={e} />)}</div>}
    </section>
  );
}