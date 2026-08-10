import { useParams, Link } from 'react-router-dom';
import { Mic } from 'lucide-react';

// Public guest recording route — scaffolded in Phase 1, fully activated in Phase 5.
export default function GuestRecording() {
  const { projectId } = useParams();

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: '#14100C' }}>
      <div className="merc-card rounded-2xl p-10 max-w-md text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center bg-[#FF9A4D]/15 border border-[#FF9A4D]/30">
          <Mic className="w-7 h-7 text-[#FF9A4D]" />
        </div>
        <h1 className="font-display text-xl text-white mb-2">Guest Recording</h1>
        <p className="text-sm text-white/60 mb-2">
          You've been invited to record for project <span className="font-mono text-[#FF9A4D]">{projectId}</span>.
        </p>
        <p className="text-xs text-white/40 mb-6">
          Browser-based guest recording activates in Phase 5 — check back soon.
        </p>
        <Link to="/" className="merc-button-dark rounded-full px-6 py-2 text-sm font-bold inline-block">
          BASE Station Home
        </Link>
      </div>
    </div>
  );
}