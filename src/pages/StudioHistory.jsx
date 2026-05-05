import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { History, Mic2, Music, Layers, Combine, Sparkles, Film, Image, FileText, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import StudioPageHeader from '@/components/studio/StudioPageHeader';

const TOOL_META = {
  music_studio:      { icon: Music,    color: 'bg-blue-600',     route: '/music-studio',      label: 'Music Studio' },
  lyrics_studio:     { icon: FileText, color: 'bg-pink-600',     route: '/lyrics-studio',     label: 'Lyrics Studio' },
  cover_art_studio:  { icon: Image,    color: 'bg-purple-600',   route: '/cover-art-studio',  label: 'Cover Art Studio' },
  video_studio:      { icon: Film,     color: 'bg-indigo-600',   route: '/video-studio',      label: 'Video Studio' },
  stem_creator:      { icon: Layers,   color: 'bg-emerald-600',  route: '/stem-creator',      label: 'Stem Creator' },
  mashup_studio:     { icon: Combine,  color: 'bg-amber-600',    route: '/mashup-studio',     label: 'Mashup Studio' },
  vocal_harmonizer:  { icon: Mic2,     color: 'bg-pink-500',     route: '/vocal-harmonizer',  label: 'Vocal Harmonizer' },
  mastering_studio:  { icon: Sparkles, color: 'bg-yellow-500',   route: '/mastering-studio',  label: 'Mastering Studio' },
  visualizer_studio: { icon: Film,     color: 'bg-fuchsia-600',  route: '/visualizer-studio', label: 'Visualizer Studio' },
  audio_remix_studio:{ icon: Sparkles, color: 'bg-cyan-600',     route: '/audio-remix-studio',label: 'Audio Remix' },
  id3_studio:        { icon: FileText, color: 'bg-slate-600',    route: '/id3-studio',        label: 'ID3 Studio' },
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function StudioHistory() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(user =>
      base44.entities.StudioHistory.filter({ user_id: user.id }, '-created_date', 100)
        .then(setEntries).catch(() => setEntries([]))
        .finally(() => setLoading(false))
    ).catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <StudioPageHeader icon={History} accent="blue"
        title="Studio History"
        subtitle="A complete log of every studio action you've taken."
        badge="Phase 3" />

      <div className="max-w-3xl mx-auto px-6 py-8">
        {loading && <p className="text-sm text-muted-foreground text-center py-12">Loading history…</p>}

        {!loading && entries.length === 0 && (
          <div className="bg-muted/30 border border-dashed border-border rounded-2xl p-12 text-center">
            <History className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
            <p className="text-sm text-muted-foreground">No studio activity yet — start creating!</p>
          </div>
        )}

        <div className="space-y-3">
          {entries.map(entry => {
            const meta = TOOL_META[entry.tool] || { icon: Sparkles, color: 'bg-slate-600', label: entry.tool };
            const Icon = meta.icon;
            return (
              <div key={entry.id} className="flex gap-3 p-4 rounded-2xl bg-card border border-border hover:border-purple-500/30 transition-all">
                <div className={`w-10 h-10 rounded-xl ${meta.color} flex items-center justify-center flex-shrink-0`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <p className="text-sm font-bold text-foreground truncate">{entry.title || meta.label}</p>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{timeAgo(entry.created_date)}</span>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    <Badge variant="outline" className="text-xs px-1.5 py-0">{meta.label}</Badge>
                    {entry.metadata?.provider && <Badge variant="outline" className="text-xs px-1.5 py-0 capitalize">{entry.metadata.provider}</Badge>}
                  </div>
                </div>
                {meta.route && (
                  <Link to={meta.route}
                    className="self-center text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1 flex-shrink-0">
                    Reopen <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}