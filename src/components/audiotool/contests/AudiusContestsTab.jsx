import { useQuery } from '@tanstack/react-query';
import { Loader2, Trophy } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ContestCard from './ContestCard';

/** Active Audius remix contests; each stem can be dropped onto the live timeline. */
export default function AudiusContestsTab() {
  const { data: contests = [], isLoading, error } = useQuery({
    queryKey: ['audius-remix-contests'],
    queryFn: async () => (await base44.functions.invoke('audiusClient', { action: 'getRemixContests', payload: { limit: 15 } })).data?.data || [],
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground flex items-center gap-2 py-6"><Loader2 className="w-4 h-4 animate-spin" /> Loading Audius remix contests…</p>;
  if (error) return <p className="text-sm text-destructive py-6">Couldn't load contests: {error.message}</p>;
  if (!contests.length) return <p className="text-sm text-muted-foreground py-6 flex items-center gap-2"><Trophy className="w-4 h-4" /> No active remix contests with stems right now.</p>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Stems are provided by the contest host for remixing. Once you send a stem, your finished export is entered as a remix of the contest track when you distribute it to Audius from Protect & Register.
      </p>
      {contests.map((c) => <ContestCard key={c.event_id} contest={c} />)}
    </div>
  );
}