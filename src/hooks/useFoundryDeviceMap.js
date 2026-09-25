import { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';

const Maps = base44.entities.FoundryDeviceMap;

/** Loads and auto-saves the mapping for one patch in one Audiotool project. */
export default function useFoundryDeviceMap(projectUrl, pluginId) {
  const [map, setMap] = useState(null);
  const mapRef = useRef(null);
  const rec = useRef(null);
  const timer = useRef(0);
  const saving = useRef(Promise.resolve());

  useEffect(() => {
    if (!pluginId) return;
    let dead = false;
    setMap(null);
    (async () => {
      const me = await base44.auth.me();
      const [row] = await Maps.filter({ user_id: me.id, project_url: projectUrl, plugin_id: pluginId }, '-updated_date', 1);
      if (dead) return;
      rec.current = row || { user_id: me.id, project_url: projectUrl, plugin_id: pluginId };
      mapRef.current = { links: row?.links || [], bypassed: row?.bypassed || [], mirror_cables: !!row?.mirror_cables };
      setMap(mapRef.current);
    })();
    return () => { dead = true; clearTimeout(timer.current); };
  }, [projectUrl, pluginId]);

  const update = useCallback((patch) => {
    const next = { ...mapRef.current, ...patch };
    mapRef.current = next;
    setMap(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      saving.current = saving.current.then(async () => {
        if (rec.current.id) await Maps.update(rec.current.id, mapRef.current);
        else rec.current = await Maps.create({ ...rec.current, ...mapRef.current });
      });
    }, 600);
  }, []);

  return { map, update };
}