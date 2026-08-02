import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

/**
 * One pillar of the Trust Center. Deliberately short: a single claim, a single
 * paragraph, and one link to the page that owns the detail. The detail must
 * never be restated here — that duplication is what the Trust Center exists to
 * eliminate.
 */
export default function TrustPillarCard({ icon: Icon, accent, label, title, body, to, linkLabel }) {
  return (
    <div className="merc-card rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${accent}1a`, border: `1px solid ${accent}40`, color: accent }}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{label}</p>
          <p className="text-base font-black text-foreground leading-tight">{title}</p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed flex-1">{body}</p>
      <Link
        to={to}
        className="text-xs font-bold text-[#FFC98A] hover:text-foreground transition-colors inline-flex items-center gap-1.5"
      >
        {linkLabel} <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}