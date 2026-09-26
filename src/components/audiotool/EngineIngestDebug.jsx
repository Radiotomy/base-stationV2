import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Cpu } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { freshAccessToken } from '@/lib/audiotool/audiotoolTokens';
import { Button } from '@/components/ui/button';
import InfoTip from '@/components/common/InfoTip';
import TIPS from '@/lib/audiotool/bridgeTips';
import AudiotoolIngestSummary from '@/components/audiotool/AudiotoolIngestSummary';

/** Admin-only diagnostic: checks the server-side BASE Engine bridge can read this project. */
export default function EngineIngestDebug({ at, projectUrl }) {
  const { user } = useAuth();
  const [ingest, setIngest] = useState({ loading: false, error: '', summary: null });
  if (user?.role !== 'admin') return null;

  const send = async () => {
    setIngest({ loading: true, error: '', summary: null });
    try {
      // The bridge job can outlive a nearly-expired key, so renew it first.
      const accessToken = await freshAccessToken(at);
      const { data } = await base44.functions.invoke('audiotoolIngestState', { project: projectUrl.trim(), access_token: accessToken });
      setIngest({ loading: false, error: '', summary: data, at: new Date() });
      toast.success(`Session sent — BASE Engines parsed ${data?.entity_count ?? 0} project parts`);
    } catch (e) {
      setIngest({ loading: false, error: e?.response?.data?.error || e.message, summary: null });
      toast.error('BASE Engines could not read the session');
    }
  };

  return (
    <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Admin · engine bridge check</p>
      <div className="flex items-center">
        <Button variant="outline" onClick={send} disabled={ingest.loading}>
          {ingest.loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Cpu className="w-4 h-4 mr-2" />}
          Send session state to BASE Engines
        </Button>
        <InfoTip text={TIPS.ingest} size="sm" className="ml-2" />
      </div>
      {ingest.error && <p className="text-sm text-destructive">{ingest.error}</p>}
      {ingest.summary && <AudiotoolIngestSummary summary={ingest.summary} at={ingest.at} />}
    </div>
  );
}