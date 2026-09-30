import { Link } from 'react-router-dom';
import { SlidersHorizontal, Wrench, ArrowRight, Sparkles } from 'lucide-react';

const STEPS = [
  { to: '/sub-station', icon: SlidersHorizontal, label: 'Continue in SUB-Station', desc: 'Arrange and mix your Audiotool material across tracks' },
  { to: '/studios/audiotool/beat?demo=1', icon: Sparkles, label: 'Generate the Hackathon Song', desc: 'Write the full demo song into your project in one click', featured: true },
  { to: '/foundry', icon: Wrench, label: 'Continue in BASE Foundry', desc: 'Design DSP patches to pair with your Audiotool devices' },
];

export default function AudiotoolNextSteps() {
  return (
    <section className="grid sm:grid-cols-3 gap-3">
      {STEPS.map(({ to, icon: Icon, label, desc, featured }) => (
        <Link key={to} to={to}
          className={`merc-card merc-card-hover rounded-2xl p-4 flex items-center gap-3 ${featured ? 'ring-1 ring-accent/60 shadow-[0_0_24px_-6px_rgba(255,154,77,0.55)]' : ''}`}>
          <Icon className="w-5 h-5 text-accent shrink-0" />
          <div className="flex-1">
            <div className={`font-bold text-sm ${featured ? 'text-iridescent' : ''}`}>{label}</div>
            <div className="text-xs text-muted-foreground">{desc}</div>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
        </Link>
      ))}
    </section>
  );
}