import { Link } from 'react-router-dom';
import { BookOpen, ArrowRight } from 'lucide-react';
import { WORKSPACE_LIST } from '@/lib/audiotool/workspaces';

const HERO = 'https://media.base44.com/images/public/69f37db5a0cc60c31a7afc80/727ee5dc0_generated_d7c51612.png';

/** /audiotool showcase: the Liquid Mercury Rack render plus brushed-metal workspace launchers. */
export default function MercuryRackHero() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-8 space-y-5">
      <div className="relative overflow-hidden rounded-3xl rack-screen">
        <img src={HERO} alt="Liquid Mercury Rack studio hardware" className="w-full aspect-[16/9] object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8">
          <p className="rack-readout text-[10px] sm:text-xs">BASE Station × Audiotool Nexus</p>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight mt-1">Audiotool Bridge</h1>
          <p className="text-muted-foreground text-sm sm:text-base mt-1 max-w-xl hidden sm:block">
            Connect Audiotool, pick a project, create in a dedicated workspace — then come back here to protect and publish.
          </p>
          <Link to="/audiotool/guide" className="inline-flex items-center gap-1.5 mt-2 text-sm text-accent hover:underline">
            <BookOpen className="w-4 h-4" /> How the Bridge works
          </Link>
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        {WORKSPACE_LIST.map((w) => (
          <Link key={w.key} to={w.to} className="rack-unit !p-4 group flex items-center gap-3 hover:border-[#FFC26E]/50 transition-colors">
            <span className="rack-screen w-10 h-10 grid place-items-center shrink-0"><w.icon className="w-5 h-5 text-[#FFC98A]" /></span>
            <span className="font-semibold text-sm flex-1">{w.label}</span>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-[#FFC98A] group-hover:translate-x-0.5 transition" />
          </Link>
        ))}
      </div>
    </div>
  );
}