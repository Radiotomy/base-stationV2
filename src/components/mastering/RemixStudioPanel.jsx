import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ExternalLink, Music, Mic2, Volume2, Sparkles } from 'lucide-react';

/**
 * RemixStudioPanel — entry point that highlights what the Audio Remix Studio can do
 * (stem extraction, VOX isolate/remove/enhance, AI vocals, remaster) and links into
 * the dedicated full-screen experience.
 */
const FEATURES = [
  { icon: Music,    label: 'Coda Edit Tasks',  desc: 'Cover, repaint a section, or extract a part', color: 'text-purple-400' },
  { icon: Mic2,     label: 'VOX Isolate',      desc: 'Pull a clean vocal track from any song', color: 'text-pink-400' },
  { icon: Volume2,  label: 'VOX Remove',       desc: 'Instrumental-only version of a track',   color: 'text-cyan-400' },
  { icon: Sparkles, label: 'Vocal Enhance',    desc: 'De-noise & polish vocal clarity',        color: 'text-emerald-400' },
];

export default function RemixStudioPanel() {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-950/40 to-purple-950/40 rounded-2xl border border-border p-6 md:p-8 space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-2xl font-black text-foreground mb-1">🎛️ Audio Remix Studio</h3>
            <p className="text-sm text-muted-foreground max-w-xl">
              Full-featured remix bay with Coda edit tasks, VOX isolation, AI vocal enhancement, segment effects, and BPM/key analysis.
            </p>
          </div>
          <Link to="/audio-remix-studio">
            <Button className="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 gap-2 font-bold">
              Open Remix Studio <ExternalLink className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {FEATURES.map(f => (
            <div key={f.label} className="bg-card/60 rounded-xl border border-border p-3">
              <f.icon className={`w-5 h-5 mb-2 ${f.color}`} />
              <p className="text-sm font-bold text-foreground">{f.label}</p>
              <p className="text-xs text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/stem-creator" className="bg-card rounded-2xl border border-border p-5 hover:border-purple-500/40 transition-all group">
          <p className="text-2xl mb-2">🎚️</p>
          <p className="font-bold text-foreground">Stem Creator</p>
          <p className="text-xs text-muted-foreground mt-1">Six-stem split — Sever engine or free on-device</p>
        </Link>
        <Link to="/mashup-studio" className="bg-card rounded-2xl border border-border p-5 hover:border-pink-500/40 transition-all group">
          <p className="text-2xl mb-2">🎤</p>
          <p className="font-bold text-foreground">Mashup Studio</p>
          <p className="text-xs text-muted-foreground mt-1">Blend tracks into seamless mashups</p>
        </Link>
        <Link to="/vocal-harmonizer" className="bg-card rounded-2xl border border-border p-5 hover:border-cyan-500/40 transition-all group">
          <p className="text-2xl mb-2">🎶</p>
          <p className="font-bold text-foreground">Vocal Harmonizer</p>
          <p className="text-xs text-muted-foreground mt-1">Generate AI harmonies for your vocals</p>
        </Link>
      </div>
    </div>
  );
}