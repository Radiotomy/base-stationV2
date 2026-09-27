import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { readLog, subscribeTelemetry } from '@/lib/audiotool/nexusTelemetry';

/** Set of Nexus device ids an AI tool created in this project (from COS telemetry). */
export default function useAiDeviceIds(projectUrl) {
  const { user } = useAuth();
  const [ids, setIds] = useState(() => new Set());

  useEffect(() => {
    if (!user?.id || !projectUrl) return undefined;
    let live = true;
    const load = () => readLog(user.id, projectUrl).then((log) => {
      if (live) setIds(new Set(log.flatMap((e) => e.deviceIds)));
    });
    load();
    const unsub = subscribeTelemetry((ev) => { if (ev.data?.project_url === projectUrl || ev.type === 'delete') load(); });
    return () => { live = false; unsub?.(); };
  }, [user?.id, projectUrl]);

  return ids;
}