import { useEffect, useState } from 'react';
import { getProjectByUrl } from '@/lib/audiotool/audiotoolProjects';
import { loadProjectCovers } from '@/lib/audiotool/projectCovers';

/** Name, snapshot and tempo of the synced Audiotool project. */
export default function useAudiotoolProjectMeta(at, projectUrl) {
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState('');

  const [cover, setCover] = useState('');
  useEffect(() => {
    setCover('');
    if (projectUrl) loadProjectCovers().then((m) => setCover(m[projectUrl] || '')).catch(() => {});
  }, [projectUrl]);

  useEffect(() => {
    if (!at || !projectUrl) return;
    setMeta(null);
    setError('');
    getProjectByUrl(at, projectUrl).then(setMeta).catch((e) => setError(e.message));
  }, [at, projectUrl]);

  return {
    meta,
    error,
    setMeta,
    title: meta?.displayName || '',
    image: cover || meta?.snapshotUrl || meta?.coverUrl || '',
    bpm: meta?.bpm ? Math.round(meta.bpm) : null,
  };
}