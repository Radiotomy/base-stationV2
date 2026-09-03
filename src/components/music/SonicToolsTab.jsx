import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Wrench, CheckCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useJobPolling } from '@/hooks/useJobPolling';
import AssetPicker from '@/components/studio/AssetPicker';
import CostBadge from '@/components/credits/CostBadge';
import SonicActionPicker, { SONIC_ACTIONS } from '@/components/music/sonic/SonicActionPicker';
import SonicActionParams from '@/components/music/sonic/SonicActionParams';
import { SONIC_TOOL_COSTS } from '@/config/musicModelCatalog';
import { handleCreditError, getProviderErrorMessage } from '@/utils/creditErrors';

/**
 * Sonic edit tools on a library track: remaster, replace section, add vocals /
 * instrumental, stitch full song. Result is an ordinary Sonic job — auto-saved
 * to the library by the server when it lands.
 */
export default function SonicToolsTab() {
  const [selected, setSelected] = useState([]);
  const [source, setSource] = useState(null);
  const [action, setAction] = useState('remaster');
  const [params, setParams] = useState({});
  const [starting, setStarting] = useState(false);
  const [jobId, setJobId] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!selected[0]) { setSource(null); return; }
    base44.entities.UserAsset.filter({ id: selected[0] }).then(r => setSource(r[0] || null));
  }, [selected]);

  const onComplete = useCallback((data) => { setResult(data); toast.success('Sonic edit ready — saved to your library'); }, []);
  const onError = useCallback((msg) => toast.error(msg || 'Sonic edit failed'), []);
  const { status, progress } = useJobPolling(jobId, onComplete, onError);
  const busy = starting || (jobId && (status === 'processing' || status === 'pending'));

  const needsUpload = action === 'add_vocals' || action === 'add_instrumental'
    ? !source?.metadata?.sonic_upload_clip_id
    : !(source?.metadata?.clip_id || source?.metadata?.sonic_upload_clip_id);
  const cost = SONIC_TOOL_COSTS[action] + (source && needsUpload ? SONIC_TOOL_COSTS.upload : 0);

  const run = async () => {
    if (!selected[0]) { toast.error('Pick a track first'); return; }
    setStarting(true); setResult(null); setJobId('');
    try {
      const r = await base44.functions.invoke('sonicEditTrack', { assetId: selected[0], action, ...params });
      setJobId(r.data.job_id);
      toast.success(`${SONIC_ACTIONS.find(a => a.id === action)?.label} started`);
    } catch (e) {
      if (!handleCreditError(e)) toast.error(getProviderErrorMessage(e) || e?.response?.data?.error || e.message);
    }
    setStarting(false);
  };

  const audioUrl = result?.audio_url || result?.output_url;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="space-y-4">
        <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
          <h3 className="text-sm font-black">1. Source Track</h3>
          <AssetPicker assetType="track" selected={selected} onChange={setSelected} />
          {source && needsUpload && (
            <p className="text-[11px] text-amber-300">This track isn't a Sonic clip yet — it will be uploaded to Sonic first (+{SONIC_TOOL_COSTS.upload} cr).</p>
          )}
        </div>
      </div>

      <div className="lg:col-span-2 space-y-4">
        <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
          <h3 className="text-sm font-black">2. Tool</h3>
          <SonicActionPicker value={action} onChange={(a) => { setAction(a); setParams({}); }} />
          <SonicActionParams action={action} value={params} onChange={setParams} sourceDuration={source?.metadata?.duration} />
          <Button onClick={run} disabled={busy || !selected[0]} className="w-full rounded-xl bg-cyan-600 hover:bg-cyan-500 gap-2 font-bold">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
            {busy ? (jobId ? `Processing… ${progress}%` : 'Starting…') : 'Run on Sonic'}
            {!busy && <CostBadge cost={cost} />}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">Charged only when the result lands. Remaster & Replace Section work best on Sonic tracks made in the last 24 hours.</p>
        </div>

        {audioUrl && (
          <div className="bg-card rounded-2xl border border-emerald-500/30 p-5 space-y-3">
            <p className="text-sm font-bold text-emerald-400 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> {result.title || 'Result ready'}</p>
            <audio controls className="w-full rounded-xl" src={audioUrl} />
            {result.audio_urls?.length > 1 && result.audio_urls.slice(1).map((u, i) => (
              <div key={u}><p className="text-xs text-muted-foreground font-semibold mb-1">Take {i + 2}</p><audio controls className="w-full rounded-xl" src={u} /></div>
            ))}
            <Button variant="outline" asChild className="rounded-xl gap-2 text-xs font-bold">
              <a href={audioUrl} download><Download className="w-3.5 h-3.5" /> Download</a>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}