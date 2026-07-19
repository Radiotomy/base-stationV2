import { useState } from 'react';
import AudiusConnectionCard from '@/components/distribution/AudiusConnectionCard';
import AudiusSyncQueue from '@/components/distribution/AudiusSyncQueue';

export default function DistributionTab({ user, assets }) {
  const [audiusProfile, setAudiusProfile] = useState(user?.metadata?.audius || null);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-black">Distribution</h2>
        <p className="text-sm text-muted-foreground">
          Manage your connected Audius channel and push tracks — with COS, C2PA and DDEX provenance bundled — to the streaming network.
        </p>
      </div>
      <AudiusConnectionCard
        audiusProfile={audiusProfile}
        onConnected={(profile) => setAudiusProfile(profile)}
        onDisconnected={() => setAudiusProfile(null)}
      />
      <AudiusSyncQueue assets={assets} connected={!!audiusProfile} />
    </div>
  );
}