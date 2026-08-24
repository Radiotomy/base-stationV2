import { useNavigate } from 'react-router-dom';
import { Sliders } from 'lucide-react';
import { sendPatchToSubStation } from '@/lib/substation/handoff';

// Hands a Foundry patch to SUB-Station as a new timeline track.
export default function SendToSubStationButton({ plugin, compact = false, className = '' }) {
  const navigate = useNavigate();

  const send = (e) => {
    e.preventDefault();
    e.stopPropagation();
    sendPatchToSubStation(plugin);
    navigate('/sub-station');
  };

  if (compact) {
    return (
      <button onClick={send} title="Send to SUB-Station"
        className={`h-7 px-2 rounded-md border border-[#14b8a6]/40 text-[#14b8a6] hover:bg-[#14b8a6]/12 transition-colors ${className}`}>
        <Sliders className="w-3 h-3" />
      </button>
    );
  }

  return (
    <button onClick={send}
      className={`h-8 px-3 rounded-md border border-[#14b8a6]/40 text-[#14b8a6] text-xs font-semibold hover:bg-[#14b8a6]/12 transition-colors inline-flex items-center gap-1.5 ${className}`}>
      <Sliders className="w-3 h-3" />
      Send to SUB-Station
    </button>
  );
}