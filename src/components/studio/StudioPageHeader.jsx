import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * Phase 3 — Reusable header for all Studio pages.
 */
export default function StudioPageHeader({ icon: Icon, title, subtitle, accent = 'purple', backTo = '/ai-studio', badge }) {
  const accentMap = {
    purple: 'from-purple-900/40 to-indigo-950',
    blue: 'from-blue-900/40 to-cyan-950',
    pink: 'from-pink-900/40 to-rose-950',
    emerald: 'from-emerald-900/40 to-teal-950',
    amber: 'from-amber-900/40 to-orange-950',
  };
  const iconColorMap = {
    purple: 'text-purple-300', blue: 'text-cyan-300', pink: 'text-pink-300',
    emerald: 'text-emerald-300', amber: 'text-amber-300',
  };
  return (
    <>
      <div className="fixed top-0 inset-x-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50 px-6 h-14 flex items-center gap-3">
        <Link to={backTo} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-semibold">Back</span>
        </Link>
        {badge && <Badge variant="outline" className="ml-auto">{badge}</Badge>}
      </div>
      <div className={`relative pt-20 pb-10 px-6 bg-gradient-to-br ${accentMap[accent]}`}>
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          {Icon && (
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Icon className={`w-7 h-7 ${iconColorMap[accent]}`} />
            </div>
          )}
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">{title}</h1>
            {subtitle && <p className="text-white/60 text-sm md:text-base mt-1">{subtitle}</p>}
          </div>
        </div>
      </div>
    </>
  );
}