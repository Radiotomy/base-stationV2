import { Link } from 'react-router-dom';
import { ShieldCheck, Sparkles, Fingerprint, Link2, ChevronRight } from 'lucide-react';

const ITEMS = [
  { icon: ShieldCheck, color: '#FFC98A', label: 'GenAI label' },
  { icon: Sparkles, color: '#6EE7B7', label: 'Ownership score' },
  { icon: Fingerprint, color: '#FFC98A', label: 'BASE Mark' },
  { icon: Link2, color: '#93C5FD', label: 'On-chain record' },
];

/**
 * Compact home strip for the provenance story. Deliberately a pointer, not an
 * explainer — the full narrative lives once, in the Trust Center.
 */
export default function HomeTrustStrip() {
  return (
    <div className="rounded-xl border-2 border-black bg-gradient-to-b from-[#1F1408] to-[#0F0A06] p-4 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-display text-white text-base md:text-lg">Protected the moment you hit save.</p>
          <p className="text-white/60 text-xs mt-1 leading-relaxed max-w-2xl">
            Every track is watermarked, scored, labeled and registered automatically — no setup, nothing to
            opt into. AI is the instrument; you stay the artist, and you leave with dated evidence of it.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
            {ITEMS.map(({ icon: Icon, color, label }) => (
              <span key={label} className="flex items-center gap-1.5 text-[11px] font-bold text-white/70">
                <Icon className="w-3.5 h-3.5" style={{ color }} />
                {label}
              </span>
            ))}
          </div>
        </div>
        <Link
          to="/trust"
          className="text-[10px] font-black rounded-full px-4 py-2 flex items-center gap-1 text-[#2A1508] flex-shrink-0 self-start lg:self-center"
          style={{
            background: 'linear-gradient(135deg, #FFB347 0%, #FF7A2F 100%)',
            boxShadow: '0 3px 10px -2px rgba(120,60,10,0.5)',
          }}
        >
          Trust &amp; Provenance <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}