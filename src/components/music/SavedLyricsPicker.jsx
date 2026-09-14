import { useState } from 'react';
import { Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { loadLyricAssetText } from '@/lib/music/lyricAssetText';

/**
 * Picks a saved lyric from the creator's library and loads its real text.
 * The text lives in a .txt file for most assets, so selection is async — the row
 * shows a spinner while loading and an explicit error if the file has no words,
 * instead of silently leaving the generator with nothing to sing.
 */
export default function SavedLyricsPicker({ assets, onSelect }) {
  const [loadingId, setLoadingId] = useState(null);
  const [loadedId, setLoadedId] = useState(null);

  const pick = async (asset) => {
    setLoadingId(asset.id);
    try {
      const text = await loadLyricAssetText(asset);
      if (!text) {
        toast.error('This saved lyric has no text to load.');
        return;
      }
      onSelect(text, asset);
      setLoadedId(asset.id);
      toast.success(`🎤 Loaded "${asset.title}"`);
    } catch {
      toast.error('Could not load that lyric — please try again.');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-1.5 max-h-48 overflow-y-auto">
      {assets.map(l => (
        <button key={l.id} onClick={() => pick(l)} disabled={loadingId === l.id}
          className="w-full text-left px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-xs transition-colors flex items-center gap-2">
          <span className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">{l.title}</p>
            <p className="text-muted-foreground truncate">{l.description}</p>
          </span>
          {loadingId === l.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-pink-400 flex-shrink-0" />}
          {loadedId === l.id && loadingId !== l.id && <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
        </button>
      ))}
    </div>
  );
}