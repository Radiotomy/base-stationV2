import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { GitFork, Waves, Play, Pause, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CATEGORY_COLOR = {
  effect: '#FF9A4D',
  instrument: '#FFC26E',
  utility: '#F5E5C7',
  modulator: '#FF6B4A',
};

// A curated reference patch. Reads as part of the same surface as PluginCard but
// leads with the teaching description and the audition clip, because the point of
// a template is "hear it, then read how it was built".
export default function TemplateCard({ template, onFork, forking }) {
  const accent = CATEGORY_COLOR[template.category] || '#FF9A4D';
  const nodeCount = template.graph_state?.nodes?.length || 0;
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) { el.play(); setPlaying(true); } else { el.pause(); setPlaying(false); }
  };

  return (
    <div className="merc-card merc-card-hover rounded-2xl p-4 flex flex-col transition-all">
      <div className="flex items-start justify-between gap-2 mb-2">
        <Link to={`/foundry/${template.id}`} className="min-w-0 group">
          <h3 className="text-sm font-semibold text-white/90 truncate group-hover:text-[#FFC98A]">
            {template.title}
          </h3>
          <span className="text-[9px] uppercase tracking-widest" style={{ color: accent }}>
            {template.category || 'effect'}
          </span>
        </Link>
        <span className="flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-full text-[8px] uppercase tracking-widest text-[#FFC98A] border border-white/12 bg-white/5">
          <BookOpen className="w-2.5 h-2.5" /> Reference
        </span>
      </div>

      <p className="text-[11px] text-white/50 leading-snug line-clamp-3 flex-1 mb-3">
        {template.description || 'A canonical reference patch.'}
      </p>

      <div className="flex items-center gap-3 text-[9px] font-mono text-white/30 mb-3">
        <span className="flex items-center gap-1"><Waves className="w-2.5 h-2.5" />{nodeCount} modules</span>
        <span className="flex items-center gap-1"><GitFork className="w-2.5 h-2.5" />{template.fork_count || 0}</span>
      </div>

      {template.audition_url && (
        <>
          <button
            onClick={toggle}
            className="flex items-center gap-1.5 mb-3 text-[10px] text-white/60 hover:text-[#FFC98A] transition-colors"
          >
            {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {playing ? 'Pause audition' : 'Hear this patch'}
          </button>
          <audio
            ref={audioRef}
            src={template.audition_url}
            onEnded={() => setPlaying(false)}
            className="hidden"
          />
        </>
      )}

      <div className="flex gap-2">
        <Button asChild size="sm" variant="outline" className="flex-1 h-7 text-[11px] border-white/12">
          <Link to={`/foundry/${template.id}`}>See how it's built</Link>
        </Button>
        <Button
          size="sm"
          disabled={forking}
          onClick={() => onFork(template)}
          className="h-7 px-2.5 text-[11px] merc-button"
        >
          <GitFork className="w-3 h-3 mr-1" /> Use
        </Button>
      </div>
    </div>
  );
}