import React, { useRef, useState } from 'react';
import { BookOpen, GitFork, Loader2, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Shown when someone opens a curated template they don't own. Explains why nothing
// is editable and offers the one action that is: fork it.
export default function TemplateInspectBanner({ template, onFork, forking }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) { el.play(); setPlaying(true); } else { el.pause(); setPlaying(false); }
  };

  return (
    <div
      className="rounded-2xl px-4 py-3 mb-3 flex items-center gap-3 flex-wrap"
      style={{
        background: 'linear-gradient(135deg, rgba(255,154,77,0.14) 0%, rgba(255,107,74,0.08) 100%)',
        border: '1px solid rgba(255,201,138,0.28)',
      }}
    >
      <BookOpen className="w-4 h-4 text-[#FFC98A] shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-white/90">Inspecting a starter template</p>
        <p className="text-[11px] text-white/50 leading-snug">
          Read-only reference — trace the wiring and parameter values, then fork it to make it yours.
        </p>
      </div>

      {template.audition_url && (
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={toggle}
            className="h-8 px-3 text-xs border-white/15 text-white/70"
          >
            {playing ? <Pause className="w-3 h-3 mr-1.5" /> : <Play className="w-3 h-3 mr-1.5" />}
            Audition
          </Button>
          <audio ref={audioRef} src={template.audition_url} onEnded={() => setPlaying(false)} className="hidden" />
        </>
      )}

      <Button size="sm" onClick={onFork} disabled={forking} className="h-8 px-3 text-xs merc-button">
        {forking ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <GitFork className="w-3 h-3 mr-1.5" />}
        Fork to edit
      </Button>
    </div>
  );
}