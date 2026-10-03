import { Link } from 'react-router-dom';
import { ExternalLink, Settings2, Loader2 } from 'lucide-react';
import PortalStageViewer from '@/components/live/PortalStageViewer';

export default function ArchitectPreview({ venues, selectedId, onSelect, busy }) {
  const venue = venues.find((v) => v.id === selectedId);
  return (
    <div className="rack-unit flex flex-col gap-3 h-full">
      <div className="rack-display">
        <span className="rack-readout text-xs flex items-center gap-2">
          <span className={`rack-led ${venue?.room_id ? 'rack-led-on' : ''}`} />
          {busy ? 'Rebuilding stage…' : venue ? venue.name : 'No venue yet'}
        </span>
        {venues.length > 0 && (
          <select value={selectedId || ''} onChange={(e) => onSelect(e.target.value)}
            className="bg-transparent text-xs text-foreground border border-border rounded-md px-2 py-1">
            {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        )}
      </div>
      <div className="relative flex-1 min-h-[280px]">
        {venue?.room_id
          ? <PortalStageViewer key={`${venue.room_id}-${venue.last_published_at}`} roomId={venue.room_id} />
          : <div className="rack-screen h-full flex items-center justify-center text-xs text-muted-foreground p-6 text-center">
              Describe your dream venue in the chat and it will appear here.
            </div>}
        {busy && (
          <div className="absolute inset-0 rounded-2xl bg-background/60 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
          </div>
        )}
      </div>
      {venue?.room_id && (
        <div className="flex gap-2 flex-wrap">
          <a href={`https://portals.to/?room=${venue.room_id}`} target="_blank" rel="noreferrer"
            className="merc-button-dark rounded-lg px-3 py-1.5 text-xs flex items-center gap-1.5">
            <ExternalLink className="w-3.5 h-3.5" /> Open fan link / builder
          </a>
          <Link to={`/live-venues/${venue.id}`} className="merc-button-dark rounded-lg px-3 py-1.5 text-xs flex items-center gap-1.5">
            <Settings2 className="w-3.5 h-3.5" /> Manual controls
          </Link>
        </div>
      )}
    </div>
  );
}