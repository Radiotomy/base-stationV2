import { ImageOff, Loader2 } from 'lucide-react';

/**
 * Tiny 48×32 Pexels preview thumbnail for a scene query.
 * Pure presentation — parent manages the URL via a debounced lookup.
 */
export default function ScenePreviewThumb({ url, loading }) {
  return (
    <div className="w-12 h-8 rounded-md overflow-hidden bg-muted/60 border border-border flex items-center justify-center flex-shrink-0">
      {loading ? (
        <Loader2 className="w-3 h-3 text-muted-foreground animate-spin" />
      ) : url ? (
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        <ImageOff className="w-3 h-3 text-muted-foreground/50" />
      )}
    </div>
  );
}