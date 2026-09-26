import { useState } from 'react';
import { Loader2, Search, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import { loadAsWavFile } from '@/lib/audiotool/localAudio';
import SendToAudiotoolButton from './SendToAudiotoolButton';

/** Pull an openly licensed Audius release into the live session as a remix starting point. */
export default function AudiusRemixTab() {
  const [query, setQuery] = useState('');
  const [state, setState] = useState({ loading: false, error: '', tracks: null });

  const search = async () => {
    setState({ loading: true, error: '', tracks: null });
    try {
      const { data } = await base44.functions.invoke('searchAudius', { query: query.trim(), limit: 20 });
      setState({ loading: false, error: '', tracks: data?.data || [] });
    } catch (e) {
      setState({ loading: false, error: e.message, tracks: null });
    }
  };

  // Import runs the server-side licence gate and files the release in the library
  // (origin: audius) before any audio reaches the timeline.
  const fetchTrack = (t) => async () => {
    const { data } = await base44.functions.invoke('importAudiusStems', { trackId: t.id });
    return loadAsWavFile(data.data.assets[0].file_url, t.title);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Search Audius and drop a Creative Commons or open-remix release onto your timeline. All Rights Reserved tracks stay locked.
      </p>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (query.trim()) search(); }}>
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Artist, track or genre" />
        <Button type="submit" variant="outline" disabled={!query.trim() || state.loading}>
          {state.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Search
        </Button>
      </form>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.tracks?.length === 0 && <p className="text-sm text-muted-foreground">No tracks found.</p>}
      <ul className="space-y-2">
        {state.tracks?.map((t) => (
          <li key={t.id} className="flex items-center gap-3 rounded-lg bg-secondary/50 px-3 py-2">
            {t.artwork?.['150x150'] && <img src={t.artwork['150x150']} alt={t.title} className="w-10 h-10 rounded object-cover" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{t.title}</p>
              <p className="text-[11px] text-muted-foreground truncate">{t.user?.name} · {t.licensing?.license}</p>
            </div>
            {t.licensing?.is_open
              ? <SendToAudiotoolButton getFile={fetchTrack(t)} name={`${t.title} by ${t.user?.name || 'Audius'}`} label="Remix in Audiotool" />
              : <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Lock className="w-3 h-3" /> Locked</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}