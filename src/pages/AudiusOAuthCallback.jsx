import { useEffect, useRef, useState } from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { getAudiusSdk } from '@/lib/audius/browserSdk';

/**
 * Redirect target for the browser-side Audius OAuth flow.
 *
 * Normally this renders inside a popup: the SDK forwards the authorization code
 * to the opener and closes the window, so nothing here is seen for more than a
 * moment. It still renders real states because the same URI is used if the
 * browser blocks the popup and Audius returns to a full page instead.
 */
export default function AudiusOAuthCallback() {
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      try {
        const sdk = await getAudiusSdk();
        // Nothing to complete if this page was opened without a code/state —
        // handleRedirect() on a bare visit throws and would read as a failure.
        if (!sdk.oauth.hasRedirectResult()) {
          setError('No Audius sign-in is in progress.');
          return;
        }
        await sdk.oauth.handleRedirect();
        setDone(true);
      } catch (e) {
        setError(e?.message || 'Could not complete Audius sign-in.');
      }
    })();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="merc-card rounded-2xl p-8 text-center max-w-sm w-full">
        {error ? (
          <>
            <AlertCircle className="w-8 h-8 mx-auto mb-3 text-destructive" />
            <p className="text-sm text-foreground font-semibold mb-1">Audius sign-in failed</p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </>
        ) : done ? (
          <>
            <CheckCircle2 className="w-8 h-8 mx-auto mb-3 text-emerald-400" />
            <p className="text-sm text-foreground font-semibold">Connected to Audius</p>
            <p className="text-xs text-muted-foreground mt-1">You can close this window.</p>
          </>
        ) : (
          <>
            <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-[#FF9A4D]" />
            <p className="text-sm text-muted-foreground">Completing Audius sign-in…</p>
          </>
        )}
      </div>
    </div>
  );
}