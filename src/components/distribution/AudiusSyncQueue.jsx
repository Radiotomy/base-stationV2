import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Music, ExternalLink, Loader2, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';
import { audiusPublishState, audiusTrackUrl } from '@/lib/audius/publishState';

const AUDIO_TYPES = ['track', 'master', 'mashup', 'harmony'];

function SyncStatusBadge({ status }) {
  if (status === 'syncing') return (
    <Badge className="bg-amber-500/20 text-amber-300 border-0 gap-1">
      <Loader2 className="w-3 h-3 animate-spin" /> Syncing via IPFS…
    </Badge>
  );
  if (status === 'live') return (
    <Badge className="bg-emerald-500/20 text-emerald-300 border-0 gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live on Audius
    </Badge>
  );
  if (status === 'simulated') return (
    <Badge
      className="bg-sky-500/15 text-sky-300 border-0 gap-1"
      title="Audius publishing is not wired up yet — this track has not been distributed."
    >
      <FlaskConical className="w-3 h-3" /> Simulated — not live
    </Badge>
  );
  return <Badge className="bg-white/10 text-white/50 border-0">Not Synced</Badge>;
}

export default function AudiusSyncQueue({ assets, connected }) {
  const [syncing, setSyncing] = useState({});   // assetId -> true while publishing
  const [published, setPublished] = useState({}); // assetId -> audius_track_id (session results)

  const audioAssets = assets.filter(a => AUDIO_TYPES.includes(a.asset_type));

  const rowState = (asset) => {
    if (syncing[asset.id]) return 'syncing';
    const id = published[asset.id] || asset.metadata?.audius_track_id;
    const state = audiusPublishState(id, asset.metadata?.audius_publish_status);
    if (state) return state;
    return 'idle';
  };

  const publish = async (asset) => {
    if (!connected) {
      toast.error('Connect your Audius account above before publishing.');
      return;
    }
    setSyncing(s => ({ ...s, [asset.id]: true }));
    try {
      const res = await base44.functions.invoke('publishToAudius', { assetId: asset.id });
      const trackId = res.data?.data?.audius_track_id;
      setPublished(p => ({ ...p, [asset.id]: trackId || true }));
      if (audiusPublishState(trackId, res.data?.data?.status) === 'simulated') {
        toast.info(`"${asset.title}" packaged with its full COS + provenance bundle — Audius delivery isn't wired up yet, so nothing was distributed.`);
      } else {
        toast.success(`"${asset.title}" published to Audius with full COS + provenance bundle`, { icon: '🛰️' });
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Publish failed');
    } finally {
      setSyncing(s => ({ ...s, [asset.id]: false }));
    }
  };

  if (audioAssets.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-border rounded-2xl">
        <Music className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-30" />
        <p className="text-muted-foreground text-sm">No audio tracks in your library yet — generate one in the Music Studio.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <h3 className="font-mono text-xs uppercase tracking-wider text-foreground">Track Sync Queue</h3>
        <span className="text-[11px] text-muted-foreground">{audioAssets.length} tracks</span>
      </div>
      <div className="divide-y divide-border">
        {audioAssets.map(asset => {
          const state = rowState(asset);
          const audiusId = published[asset.id] || asset.metadata?.audius_track_id;
          const cos = asset.human_participation_score;
          return (
            <div key={asset.id} className="px-5 py-3 flex items-center gap-3 flex-wrap sm:flex-nowrap">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{asset.title}</p>
                <p className="text-[11px] text-muted-foreground capitalize">{asset.asset_type}</p>
              </div>
              <div className="w-20 flex-shrink-0 text-center">
                {cos != null ? (
                  <span className={`font-mono text-sm font-bold ${cos >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {Math.round(cos)}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground">COS</p>
              </div>
              <div className="w-40 flex-shrink-0">
                <SyncStatusBadge status={state} />
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <Switch
                  checked={state === 'live' || state === 'syncing' || state === 'simulated'}
                  disabled={state === 'live' || state === 'syncing'}
                  onCheckedChange={(on) => on && publish(asset)}
                  title={state === 'live' ? 'Already live on Audius' : state === 'simulated' ? 'Simulated publish — Audius delivery is not wired up yet' : 'Publish to Audius Network'}
                />
                {state === 'live' && typeof audiusId === 'string' && audiusTrackUrl(audiusId) ? (
                  <a
                    href={audiusTrackUrl(audiusId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs font-bold text-emerald-400 hover:text-emerald-300"
                  >
                    View <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="w-12" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}