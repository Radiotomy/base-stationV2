import { useState } from 'react';
import { Loader2, CheckCircle2, XCircle, ChevronDown } from 'lucide-react';

const LABELS = {
  createPortalVenue: 'Building your venue',
  applyVenueTemplate: 'Switching the stage look',
  updateVenueBranding: 'Applying branding',
  pushVenueStaff: 'Placing venue staff',
  updatePortalRoomSettings: 'Updating room settings',
};

function parse(v) {
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return v; }
}

export default function ArchitectToolCall({ toolCall }) {
  const [open, setOpen] = useState(false);
  const results = parse(toolCall.results);
  const running = ['pending', 'running', 'in_progress'].includes(toolCall.status);
  const failed = ['failed', 'error'].includes(toolCall.status)
    || results?.success === false || !!results?.error;
  const fn = (toolCall.name || '').split('.').pop();
  const label = LABELS[fn] || fn.replace(/_/g, ' ');
  const hidden = toolCall.display_projection?.hide_details && toolCall.display_projection?.details_redacted;

  return (
    <div className="mt-2 rack-screen px-3 py-2 text-xs">
      <button onClick={() => !hidden && setOpen(!open)} className="flex items-center gap-2 w-full text-left">
        {running ? <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
          : failed ? <XCircle className="w-3.5 h-3.5 text-destructive" />
          : <CheckCircle2 className="w-3.5 h-3.5 text-accent" />}
        <span className="rack-readout text-[10px] flex-1">{label}{running ? '…' : failed ? ' — failed' : ''}</span>
        {!hidden && <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>
      {open && (
        <pre className="mt-2 text-[10px] text-muted-foreground whitespace-pre-wrap break-all max-h-48 overflow-auto">
          {JSON.stringify({ input: parse(toolCall.arguments_string), result: results }, null, 2)}
        </pre>
      )}
    </div>
  );
}