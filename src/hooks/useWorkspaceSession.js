import { useEffect, useState } from 'react';
import useAudiotool from '@/hooks/useAudiotool';
import useNexusProject from '@/hooks/useNexusProject';
import useAudiotoolProjectMeta from '@/hooks/useAudiotoolProjectMeta';
import { readDeepLink, syncAddressBar } from '@/lib/audiotool/deepLinks';

/**
 * Sign-in + one live Nexus document for a creative workspace. A `?open=` link
 * (from the Bridge or another workspace) reopens the same project on arrival.
 */
export default function useWorkspaceSession() {
  const audiotool = useAudiotool();
  const project = useNexusProject(audiotool.at);
  const [projectUrl, setProjectUrl] = useState('');
  const synced = project.status === 'synced';
  const meta = useAudiotoolProjectMeta(audiotool.at, synced ? projectUrl : '');

  const open = (url) => {
    const link = url.trim();
    setProjectUrl(link);
    syncAddressBar(link);
    project.open(link);
  };

  useEffect(() => {
    if (audiotool.status !== 'authenticated') return;
    const { open: link } = readDeepLink();
    if (link) open(link);
  }, [audiotool.status]); // eslint-disable-line react-hooks/exhaustive-deps

  return { audiotool, at: audiotool.at, project, projectUrl, meta, synced, open };
}