import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Megaphone } from 'lucide-react';

/** Lists previously generated promo packages (visualizer assets linked to a promo card). */
export default function SavedPromoPackages({ onOpen, refreshKey }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    base44.auth.me()
      .then(u => base44.entities.UserAsset.filter({ user_id: u.id, asset_type: 'visualizer' }, '-created_date', 50))
      .then(rows => setItems(rows.filter(r => r.metadata?.promo_card_url)))
      .catch(() => setItems([]));
  }, [refreshKey]);

  if (items.length === 0) return null;

  return (
    <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
      <h3 className="text-sm font-black flex items-center gap-2">
        <Megaphone className="w-4 h-4 text-orange-400" /> My Promo Packages
      </h3>
      <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
        {items.map(asset => (
          <button key={asset.id} type="button" onClick={() => onOpen(asset)}
            className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-border bg-muted/30 hover:border-orange-500/50 transition-all text-left">
            <img src={asset.metadata.promo_card_url} alt=""
              className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-black/30" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{asset.title}</p>
              <p className="text-[10px] text-muted-foreground truncate">
                {asset.metadata.promo_platform?.replace(/_/g, ' ')} · {asset.metadata.visualizer_style}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}