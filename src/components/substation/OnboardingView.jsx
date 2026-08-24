import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Layers, Sparkles, Share2, BookOpen } from 'lucide-react';

const POINTS = [
  { icon: Layers, title: 'Arrange anything', body: 'Unlimited synth, audio and aux lanes with snap-to-grid clip editing, slicing and volume automation.' },
  { icon: Sparkles, title: 'Import from every studio', body: 'Pull tracks, stems and masters you generated elsewhere in BASE Station straight onto the timeline.' },
  { icon: Share2, title: 'Split sheet + COS handoff', body: 'Balance collaborator shares to exactly 100% and export a manifest ready for the ownership pipeline.' },
];

export default function OnboardingView({ onDemo, onEmpty }) {
  return (
    <div className="min-h-screen" style={{ background: '#09090b' }}>
      <div className="max-w-3xl mx-auto px-5 py-16">
        <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-[#14b8a6] mb-3">BASE Station Module</p>
        <h1 className="text-4xl font-display text-white mb-3">SUB-Station Studio</h1>
        <p className="text-sm text-white/55 leading-relaxed max-w-xl mb-8">
          A browser multi-track workstation where the whole platform converges: arrange your generated
          audio, design the mix, settle the splits, and hand a complete manifest to BASE Station's
          ownership pipeline.
        </p>

        <div className="grid sm:grid-cols-3 gap-3 mb-9">
          {POINTS.map(p => (
            <div key={p.title} className="rounded-xl border border-white/10 bg-black/40 p-3.5">
              <p.icon className="w-4 h-4 text-[#FF9A4D] mb-2" />
              <p className="text-xs font-semibold text-white/90 mb-1">{p.title}</p>
              <p className="text-[11px] text-white/45 leading-snug">{p.body}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button onClick={onDemo} className="h-10 px-5 text-xs font-bold"
            style={{ background: 'linear-gradient(135deg,#14b8a6,#0d9488)', color: '#04211d' }}>
            Open the demo arrangement
          </Button>
          <Button onClick={onEmpty} variant="outline" className="h-10 px-5 text-xs border-white/15 text-white/70">
            Start from empty
          </Button>
          <Link to="/sub-station/help" className="inline-flex items-center gap-1.5 text-[11px] text-[#FFC98A] hover:text-white ml-1">
            <BookOpen className="w-3 h-3" /> Read the guide
          </Link>
        </div>

        <p className="text-[10px] text-white/30 mt-6">
          Sessions save to this browser only. By using this module you accept the{' '}
          <Link to="/sub-station/terms" className="underline hover:text-white/60">SUB-Station terms</Link>.
        </p>
      </div>
    </div>
  );
}