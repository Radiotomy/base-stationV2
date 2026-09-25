import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAudiotool, takeReturnPath } from '@/lib/audiotool/nexusClient';

/** Audiotool sign-in return page — the SDK redeems ?code here, then we go back to where login started. */
export default function AudiotoolCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    getAudiotool().catch(() => {}).finally(() => navigate(takeReturnPath(), { replace: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <div className="w-8 h-8 border-4 border-[#FF9A4D]/30 border-t-[#FF9A4D] rounded-full animate-spin" />
      <p className="text-sm text-muted-foreground">Connecting Audiotool…</p>
    </div>
  );
}