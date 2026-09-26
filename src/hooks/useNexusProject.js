import { useCallback, useEffect, useRef, useState } from 'react';

export const NEXUS_KINDS = [
  ['note', 'Notes'],
  ['noteTrack', 'Note tracks'],
  ['audioTrack', 'Audio tracks'],
  ['automationEvent', 'Automation points'],
  ['desktopAudioCable', 'Audio cables'],
  ['desktopNoteCable', 'Note cables'],
];

const release = async (entry) => {
  clearTimeout(entry.timer);
  entry.subs.forEach((s) => s.terminate());
  await entry.doc.stop();
};

/**
 * Opens an Audiotool project as a live, synced Nexus document. One wildcard
 * create/remove listener (registered before start(), as the SDK requires)
 * drives a `version` counter that bumps whenever anything is added or removed —
 * locally, in the DAW, or by a collaborator — so every panel stays live.
 */
export default function useNexusProject(at) {
  const ref = useRef(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [counts, setCounts] = useState({});
  const [version, setVersion] = useState(0);
  const [connected, setConnected] = useState(true);

  const recount = useCallback((doc) => {
    if (ref.current?.doc !== doc) return;
    setCounts(Object.fromEntries(NEXUS_KINDS.map(([t]) => [t, doc.queryEntities.ofTypes(t).get().length])));
    setVersion((v) => v + 1);
  }, []);

  const open = async (projectUrl) => {
    setStatus('opening');
    setError('');
    try {
      if (ref.current) { const old = ref.current; ref.current = null; await release(old); }
      const doc = await at.open(projectUrl.trim());
      const entry = { doc, subs: [], timer: null };
      // Batches bursts (start() replays every existing entity) into one recount.
      const schedule = () => { clearTimeout(entry.timer); entry.timer = setTimeout(() => recount(doc), 150); };
      entry.subs.push(
        doc.events.onCreate('*', () => { schedule(); return schedule; }),
        doc.connected.subscribe(setConnected, true),
      );
      ref.current = entry;
      await doc.start();
      recount(doc);
      setStatus('synced');
    } catch (e) {
      if (ref.current) { const failed = ref.current; ref.current = null; release(failed).catch(() => {}); }
      setError(e.message);
      setStatus('idle');
    }
  };

  useEffect(() => () => { if (ref.current) release(ref.current); }, []);

  return {
    nexus: ref.current?.doc || null, status, error, counts, version, connected, open,
    refresh: () => ref.current && recount(ref.current.doc),
  };
}