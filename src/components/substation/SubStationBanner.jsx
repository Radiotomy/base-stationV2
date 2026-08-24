import { Link } from 'react-router-dom';
import { Sliders, ArrowRight } from 'lucide-react';

// Discovery banner shown at the top of the Foundry route.
export default function SubStationBanner() {
  return (
    <Link
      to="/sub-station"
      className="block mb-6 rounded-2xl border border-[#14b8a6]/30 p-4 transition-colors hover:border-[#14b8a6]/60"
      style={{ background: 'linear-gradient(120deg, rgba(20,184,166,0.14) 0%, rgba(9,9,11,0.9) 55%, rgba(255,154,77,0.10) 100%)' }}
    >
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-9 h-9 rounded-xl grid place-items-center shrink-0"
          style={{ background: 'linear-gradient(135deg,#14b8a6,#0d9488)' }}>
          <Sliders className="w-4 h-4 text-[#04211d]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-[#14b8a6] mb-0.5">New module</p>
          <p className="text-sm font-bold text-white">SUB-Station Studio — multi-track arrangement workstation</p>
          <p className="text-[11px] text-white/50 leading-snug mt-0.5">
            Arrange your generated audio, run your Foundry patches on real tracks, settle the split sheet,
            and bounce master + stems with a COS-ready manifest.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#14b8a6] shrink-0">
          Open <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </Link>
  );
}