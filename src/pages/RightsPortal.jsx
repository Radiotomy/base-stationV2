import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Scale, Search } from 'lucide-react';
import RightsStatsBar from '@/components/rights/RightsStatsBar';
import RightsAssetRow from '@/components/rights/RightsAssetRow';
import FlagReportDialog from '@/components/governance/FlagReportDialog';

const AUDIO_TYPES = ['track', 'master', 'stem', 'mashup', 'harmony', 'sfx'];

export default function RightsPortal() {
  const [user, setUser] = useState(null);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [manifestId, setManifestId] = useState(null);

  useEffect(() => {
    (async () => {
      const me = await base44.auth.me();
      setUser(me);
      const rows = await base44.entities.UserAsset.filter({ user_id: me.id }, '-created_date', 200);
      setAssets(rows.filter(a => AUDIO_TYPES.includes(a.asset_type)));
      setLoading(false);
    })();
  }, []);

  const filtered = assets.filter(a => (a.title || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Scale className="w-6 h-6 text-[#FF9A4D]" />
            <h1 className="text-3xl font-display text-iridescent">Rights Management Portal</h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-xl">
            One place to manage the rights posture of your catalog — ownership scores, disclosure labels,
            BASE Mark watermarks, anchored manifests, and DDEX disclosure exports for distributors.
          </p>
        </div>
        {user && <FlagReportDialog user={user} />}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-[#FF9A4D]/30 border-t-[#FF9A4D] rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <RightsStatsBar assets={assets} />

          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your catalog…" className="pl-9 rounded-xl" />
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-2xl">
              <Scale className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">
                {assets.length === 0
                  ? 'No audio assets yet — tracks you create in the studios appear here with full rights records.'
                  : 'No assets match your search.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(asset => (
                <RightsAssetRow key={asset.id} asset={asset}
                  manifestOpen={manifestId === asset.id}
                  onToggleManifest={() => setManifestId(manifestId === asset.id ? null : asset.id)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}