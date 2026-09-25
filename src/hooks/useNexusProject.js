import { useCallback, useEffect, useRef, useState } from 'react';

export const NEXUS_KINDS = [
  ['note', 'Notes'],
  ['noteTrack', 'Note tracks'],
  ['audioTrack', 'Audio tracks'],
  ['automationEvent', 'Automation points'],
  ['desktopAudioCable', 'Audio cables'],
  ['desktopNoteCable', 'Note cables'],
];

/** Opens an Audiotool project as a live, synced Nexus document. */
export default function useNexusProject(at) {
  const docRef = useRef(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [counts, setCounts] = useState({});

  const count = useCallback((doc) => {
    setCounts(Object.fromEntries(NEXUS_KINDS.map(([t]) => [t, doc.queryEntities.ofTypes(t).get().length])));
  }, []);

  const open = async (projectUrl) => {
    setStatus('opening');
    setError('');
    try {
      if (docRef.current) await docRef.current.stop();
      const doc = await at.open(projectUrl.trim());
      await doc.start();
      docRef.current = doc;
      count(doc);
      setStatus('synced');
    } catch (e) {
      docRef.current = null;
      setError(e.message);
      setStatus('idle');
    }
  };

  useEffect(() => () => { docRef.current?.stop(); }, []);

  return {
    nexus: docRef.current, status, error, counts, open,
    refresh: () => docRef.current && count(docRef.current),
  };
}