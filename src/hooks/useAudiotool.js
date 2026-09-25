import { useCallback, useEffect, useState } from 'react';
import { getAudiotool, loginToAudiotool } from '@/lib/audiotool/nexusClient';

export default function useAudiotool() {
  const [state, setState] = useState({ status: 'loading', at: null, error: '' });

  useEffect(() => {
    let live = true;
    getAudiotool()
      .then((at) => live && setState({
        status: at.status, at,
        error: at.error ? String(at.error.message || at.error) : '',
      }))
      .catch((e) => live && setState({ status: 'error', at: null, error: e?.response?.data?.error || e.message }));
    return () => { live = false; };
  }, []);

  const login = useCallback(() => loginToAudiotool(window.location.pathname + window.location.search), []);
  // The SDK's logout clears its tokens and reloads the page.
  const logout = useCallback(() => state.at?.logout?.(), [state.at]);

  return { ...state, userName: state.at?.userName, login, logout };
}