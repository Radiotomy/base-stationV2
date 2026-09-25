import { Link } from 'react-router-dom';
import { SlidersHorizontal, Wrench, ArrowRight } from 'lucide-react';

const STEPS = [
  { to: '/sub-station', icon: SlidersHorizontal, label: 'SUB-Station', desc: 'Arrange and mix your Audiotool material across tracks' },
  { to: '/foundry', icon: Wrench, label: 'BASE Foundry', desc: 'Design DSP patches to pair with your Audiotool devices' },
];

export default function AudiotoolNextSteps() {
  return (
    <section className="grid sm:grid-cols-2 gap-3">
      {STEPS.map(({ to, icon: Icon, label, desc }) => (
        <Link key={to} to={to} className="merc-card merc-card-hover rounded-2xl p-4 flex items-center gap-3">
          <Icon className="w-5 h-5 text-accent shrink-0" />
          <div className="flex-1">
            <div className="font-bold text-sm">Continue in {label}</div>
            <div className="text-xs text-muted-foreground">{desc}</div>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
        </Link>
      ))}
    </section>
  );
}