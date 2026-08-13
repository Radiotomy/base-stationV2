import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Download, Share2, Trash2, Play, Pause, Calendar, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { format } from 'date-fns';

/**
 * VideoAssetCard — Compact preview card for a generated video asset.
 * Hover to play, click actions to download/share/delete.
 */
export default function VideoAssetCard({ asset, onDelete }) {
  const [hovering, setHovering] = useState(false);
  const videoRef = useRef(null);

  const provider = asset.metadata?.provider || 'unknown';
  const PROVIDER_LABELS = { ltx: 'LTX', shotstack: 'Shotstack', nextcut: 'NextCut (legacy)' };
  const providerLabel = PROVIDER_LABELS[provider] || provider;
  const providerColor = provider === 'ltx'
    ? 'bg-violet-500/15 text-violet-300 border-violet-500/30'
    : provider === 'shotstack' || provider === 'nextcut'
    ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
    : 'bg-muted text-muted-foreground border-border';

  const handleHover = (entering) => {
    setHovering(entering);
    const v = videoRef.current;
    if (!v) return;
    if (entering) {
      v.currentTime = 0;
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  };

  const handleShare = async (e) => {
    e.stopPropagation();
    try {
      if (navigator.share) {
        await navigator.share({ title: asset.title, url: asset.file_url });
      } else {
        await navigator.clipboard.writeText(asset.file_url);
        toast.success('Link copied to clipboard');
      }
    } catch (err) {
      if (err?.name !== 'AbortError') toast.error('Share failed');
    }
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!confirm(`Delete "${asset.title}"? This cannot be undone.`)) return;
    onDelete(asset.id);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onMouseEnter={() => handleHover(true)}
      onMouseLeave={() => handleHover(false)}
      className="merc-card merc-card-hover relative rounded-2xl overflow-hidden group"
    >
      {/* Video preview */}
      <div className="relative aspect-video bg-black overflow-hidden">
        <video
          ref={videoRef}
          src={asset.file_url}
          muted
          loop
          playsInline
          preload="metadata"
          className="w-full h-full object-cover"
        />
        {/* Play indicator when not hovering */}
        {!hovering && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
            <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
              <Play className="w-5 h-5 text-black ml-0.5" />
            </div>
          </div>
        )}
        {/* Provider badge */}
        <div className="absolute top-2 left-2">
          <Badge variant="outline" className={`text-[10px] font-bold ${providerColor}`}>
            <Sparkles className="w-2.5 h-2.5 mr-1" />
            {providerLabel}
          </Badge>
        </div>
      </div>

      {/* Metadata */}
      <div className="p-3 space-y-1.5">
        <h3 className="text-sm font-bold text-foreground line-clamp-1">{asset.title || 'Untitled video'}</h3>
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {asset.created_date ? format(new Date(asset.created_date), 'MMM d, yyyy') : '—'}
        </p>

        {/* Actions */}
        <div className="flex gap-1 pt-1">
          <a href={asset.file_url} download className="flex-1" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="outline" className="w-full h-7 gap-1 rounded-lg text-xs">
              <Download className="w-3 h-3" /> Download
            </Button>
          </a>
          <Button size="sm" variant="outline" onClick={handleShare} className="h-7 px-2 rounded-lg" title="Share">
            <Share2 className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="outline" onClick={handleDelete} className="h-7 px-2 rounded-lg hover:bg-rose-500/10 hover:text-rose-300 hover:border-rose-500/40" title="Delete">
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}