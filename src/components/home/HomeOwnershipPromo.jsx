import { Link } from 'react-router-dom';
import { Fingerprint, ChevronRight } from 'lucide-react';
import ParticipationBadge from '@/components/music/ParticipationBadge';

/**
 * Home promo strip for the Creative Ownership Score (COS) system.
 */
export default function HomeOwnershipPromo() {
  return (
    <div className="rounded-xl border-2 border-black bg-gradient-to-b from-[#12201A] to-[#0C120E] p-4 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="flex flex-col md:flex-row items-center gap-4">
        <div className="flex items-center gap-3 flex-shrink-0">
          {[20, 55, 90].map(s => <ParticipationBadge key={s} score={s} size={44} />)}
        </div>
        <div className="flex-1 min-w-0 text-center md:text-left">
          <p className="text-white font-black text-sm flex items-center justify-center md:justify-start gap-2">
            <Fingerprint className="w-4 h-4 text-emerald-400" /> NEW · Creative Ownership Score
          </p>
          <p className="text-white/60 text-xs mt-1 leading-relaxed">
            A growing 0–100 standard that credits the human behind the AI. Write your own lyrics, bring references,
            shape the style — and earn the <span className="text-emerald-300 font-bold">AI-Assisted</span> label
            instead of <span className="text-blue-300 font-bold">AI-Generated</span>. Built on the RIAA/IFPI method.
          </p>
        </div>
        <Link
          to="/creative-ownership"
          className="text-[10px] font-black rounded-full px-3.5 py-1.5 flex items-center gap-1 text-[#08201A] flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #6EE7B7 0%, #10B981 100%)',
            boxShadow: '0 3px 10px -2px rgba(16,185,129,0.5)',
          }}
        >
          How It Works <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}