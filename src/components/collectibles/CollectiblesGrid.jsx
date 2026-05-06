import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Award } from 'lucide-react';
import CollectibleCard from './CollectibleCard';

/**
 * Phase 5 — Reusable grid of collectibles for a creator.
 * Used on ArtistProfile and CreatorStore.
 */
export default function CollectiblesGrid({ creatorId }) {
  const [items, setItems] = useState([]);
  const [claimedIds, setClaimedIds] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await base44.functions.invoke('getCollectiblesForCreator', { creatorId });
      setItems(r.data?.data?.collectibles || []);
      setClaimedIds(r.data?.data?.claimedIds || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { if (creatorId) load(); }, [creatorId]);

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground text-sm">Loading collectibles…</div>;
  }
  if (!items.length) {
    return (
      <div className="text-center py-12 border border-dashed border-border rounded-2xl">
        <Award className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-30" />
        <p className="text-sm text-muted-foreground">No collectibles yet</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {items.map(c => (
        <CollectibleCard
          key={c.id}
          collectible={c}
          claimed={claimedIds.includes(c.id)}
          onClaimed={() => load()}
        />
      ))}
    </div>
  );
}