import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAudiotool, isAudiotoolRedirect, takeReturnPath } from '@/lib/audiotool/nexusClient';

/** Completes the Audiotool PKCE exchange when consent returns to "/", then goes back to where login started. */
export default function AudiotoolRedirectHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAudiotoolRedirect()) return;
    getAudiotool().finally(() => navigate(takeReturnPath(), { replace: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}