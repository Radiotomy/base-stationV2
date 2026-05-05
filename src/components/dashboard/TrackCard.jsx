import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, Image, FileText, Film, Trash2, ChevronDown, Download, Shield, Zap, Clock, Mic2, Hash } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import StudioAudioPlayer from '@/components/audio/StudioAudioPlayer';
import OpenInStudioMenu from '@/components/studio/OpenInStudioMenu';

const ASSET_ICONS = {
  track:    { icon: Music,    color: 'from-blue-600 to-cyan-700' },
  lyric:    { icon: FileText, color: 'from-pink-600 to-rose-700' },
  coverart: { icon: Image,    color: 'from-purple-600 to-violet-700' },
  project:  { icon: Film,     color: 'from-indigo-600 to-purple-700' },
};

/**
 * Direct download — fetches the file as a blob so the browser saves it
 * instead of opening it in a new tab.
 */
async function directDownload(url, filename) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    // Fallback: open in new tab if CORS blocks blob fetch
    window.open(url, '_blank');
  }
}

function DownloadButton({ url, label, ext, title }) {
  const [loading, setLoading] = useState(false);
  const handle = async () => {
    if (!url) return;
    setLoading(true);
    const safe = (title || 'track').replace(/[^a-z0-9\s-]/gi, '').trim().replace(/\s+/g, '_');
    await directDownload(url, `${safe}.${ext}`);
    setLoading(false);
    toast.success(`Downloading ${ext.toUpperCase()}…`);
  };
  return (
    <Button onClick={handle} disabled={loading || !url} variant="outline" size="sm"
      className="rounded-lg gap-1.5 text-xs flex-1">
      <Download className="w-3 h-3" />
      {loading ? '…' : label}
    </Button>
  );
}

export default function TrackCard({ asset, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const { icon: Icon, color } = ASSET_ICONS[asset.asset_type] || ASSET_ICONS.track;
  const isTrack = asset.asset_type === 'track';
  const m = asset.metadata || {};

  const createdAt = asset.created_date
    ? new Date(asset.created_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  // WAV url heuristic: if URL has an extension we can swap, try .wav; otherwise same URL (providers vary)
  const mp3Url = asset.file_url;
  const wavUrl = asset.file_url?.replace(/\.(mp3|m4a|aac|ogg)(\?.*)?$/i, '.wav') !== asset.file_url
    ? asset.file_url.replace(/\.(mp3|m4a|aac|ogg)(\?.*)?$/i, '.wav')
    : null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-card border border-border hover:border-purple-500/30 transition-all overflow-hidden">

      {/* Top row */}
      <div className="p-4 flex items-center gap-3">
        {/* Thumbnail / icon */}
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex-shrink-0 flex items-center justify-center overflow-hidden`}>
          {asset.thumbnail_url
            ? <img src={asset.thumbnail_url} alt={asset.title} className="w-full h-full object-cover" />
            : <Icon className="w-5 h-5 text-white/70" />}
        </div>

        {/* Title + quick badges */}
        <div className="flex-1 min-w-0">
          <p className="font-black text-sm text-foreground truncate">{asset.title}</p>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {m.genre   && <Badge variant="outline" className="text-xs px-1.5 py-0">{m.genre}</Badge>}
            {m.mood    && <Badge variant="outline" className="text-xs px-1.5 py-0">{m.mood}</Badge>}
            {m.bpm     && <Badge variant="outline" className="text-xs px-1.5 py-0">{m.bpm} BPM</Badge>}
            {m.key     && <Badge variant="outline" className="text-xs px-1.5 py-0">{m.key}</Badge>}
            {m.id3_tagged && <Badge className="text-xs px-1.5 py-0 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">ID3 ✓</Badge>}
          </div>
        </div>

        {/* Expand + delete */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => setExpanded(p => !p)}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
            onClick={() => onDelete(asset.id)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Studio audio player (tracks only) */}
      {isTrack && asset.file_url && !audioError && (
        <div className="px-4 pb-3">
          <StudioAudioPlayer
            src={asset.file_url}
            title={asset.title}
            artist={m.artist || m.audius_artist}
            artworkUrl={asset.thumbnail_url}
            compact
          />
        </div>
      )}

      {/* Download buttons + Open in Studio — always visible for tracks */}
      {isTrack && asset.file_url && (
        <div className="px-4 pb-4 flex gap-2 flex-wrap items-center">
          <DownloadButton url={mp3Url} label="Download MP3" ext="mp3" title={asset.title} />
          {wavUrl && <DownloadButton url={wavUrl} label="Download WAV" ext="wav" title={asset.title} />}
          <OpenInStudioMenu asset={asset} />
        </div>
      )}

      {/* Expanded detail panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border/60">
            <div className="p-4 space-y-4">

              {/* Full metadata grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: 'Genre',    value: m.genre,    icon: Music },
                  { label: 'Mood',     value: m.mood,     icon: Zap },
                  { label: 'BPM',      value: m.bpm,      icon: Zap },
                  { label: 'Key',      value: m.key,      icon: Mic2 },
                  { label: 'Duration', value: m.duration ? `${m.duration}s` : null, icon: Clock },
                  { label: 'Provider', value: m.provider, icon: Shield },
                  { label: 'Model',    value: m.model,    icon: Shield },
                  { label: 'AI',       value: m.ai_assisted ? 'AI Generated' : null, icon: Zap },
                  { label: 'Created',  value: createdAt,  icon: Clock },
                ].filter(r => r.value).map(({ label, value, icon: RIcon }) => (
                  <div key={label} className="bg-muted/40 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <RIcon className="w-3 h-3 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground font-semibold uppercase">{label}</p>
                    </div>
                    <p className="text-sm font-bold text-foreground truncate">{value}</p>
                  </div>
                ))}
              </div>

              {/* Original prompt */}
              {m.prompt && (
                <div className="bg-muted/40 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground font-semibold uppercase mb-1 flex items-center gap-1.5">
                    <Zap className="w-3 h-3" /> Generation Prompt
                  </p>
                  <p className="text-sm text-foreground/80 leading-relaxed">{m.prompt}</p>
                </div>
              )}

              {/* Sound prompt */}
              {m.sound_prompt && (
                <div className="bg-muted/40 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground font-semibold uppercase mb-1 flex items-center gap-1.5">
                    <Mic2 className="w-3 h-3" /> Sound Prompt
                  </p>
                  <p className="text-sm text-foreground/80 leading-relaxed">{m.sound_prompt}</p>
                </div>
              )}

              {/* Lyrics */}
              {m.lyrics && (
                <div className="bg-muted/40 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground font-semibold uppercase mb-2 flex items-center gap-1.5">
                    <FileText className="w-3 h-3" /> Lyrics
                  </p>
                  <pre className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap font-sans">{m.lyrics}</pre>
                </div>
              )}

              {/* Content hash / provenance */}
              {m.content_hash && (
                <div className="flex items-center gap-2 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                  <Hash className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-emerald-400">Content Hash (Provenance)</p>
                    <p className="text-xs font-mono text-muted-foreground truncate">{m.content_hash}</p>
                  </div>
                </div>
              )}

              {/* Non-track asset: download link */}
              {!isTrack && asset.file_url && (
                <DownloadButton url={asset.file_url} label={`Download ${asset.asset_type}`} ext="txt" title={asset.title} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}