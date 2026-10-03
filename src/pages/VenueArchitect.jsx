import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import ArchitectChat from '@/components/live/architect/ArchitectChat';
import ArchitectPreview from '@/components/live/architect/ArchitectPreview';

export default function VenueArchitect() {
  const [venues, setVenues] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async (preferNewest = false) => {
    const rows = (await base44.entities.PortalVenue.list('-updated_date', 50)).filter((v) => v.status !== 'archived');
    setVenues(rows);
    setSelectedId((cur) => (preferNewest || !cur ? rows[0]?.id : cur) || null);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-5">
        <div>
          <h1 className="text-4xl font-display">Venue Architect</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Describe your show and watch your 3D venue build itself. Your venue is yours from day one — connect your own Portals key anytime to own it on Portals too.
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:h-[calc(100vh-220px)]">
          <ArchitectChat onToolsSettled={() => load(true)} onBusyChange={setBusy} />
          <ArchitectPreview venues={venues} selectedId={selectedId} onSelect={setSelectedId} busy={busy} />
        </div>
      </div>
    </div>
  );
}