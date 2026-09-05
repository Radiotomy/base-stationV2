import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, AlertTriangle, Headphones } from 'lucide-react';

/**
 * Audius OAuth landing page. Hands the authorization code to the backend for
 * exchange — the tokens are never held here.
 */
export default function AudiusCallback() {
  const navigate = useNavigate();
  const [state, setState] = useState('working');
  const [message, setMessage] = useState('');
  const [handle, setHandle] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    // The authorization code is single-use — a second exchange always fails, so this
    // must not re-run when React remounts the effect.
    if (ran.current) return;
    ran.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const returnedState = params.get('state');
    const denied = params.get('error');

    if (denied) {
      setState('error');
      setMessage(params.get('error_description') || 'Authorization was cancelled.');
      return;
    }
    if (!code || !returnedState) {
      setState('error');
      setMessage('This page was opened without an Audius authorization result.');
      return;
    }

    base44.functions
      .invoke('audiusOAuthCallback', { code, state: returnedState })
      .then((res) => {
        const data = res.data?.data;
        if (!data?.connected) throw new Error(res.data?.error || 'Audius did not confirm the connection.');
        setHandle(data.handle || '');
        setState('done');
      })
      .catch((e) => {
        setState('error');
        setMessage(e?.response?.data?.error || e.message || 'Could not complete the Audius connection.');
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="merc-card rounded-2xl p-8 max-w-md w-full text-center">
        <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
          <Headphones className="w-6 h-6 text-emerald-400" />
        </div>

        {state === 'working' && (
          <>
            <h1 className="text-lg font-bold text-foreground mb-2">Connecting your Audius account…</h1>
            <p className="text-sm text-muted-foreground mb-4">Finishing authorization with Audius.</p>
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto" />
          </>
        )}

        {state === 'done' && (
          <>
            <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-3" />
            <h1 className="text-lg font-bold text-foreground mb-2">Audius connected</h1>
            <p className="text-sm text-muted-foreground mb-5">
              {handle ? `You're linked as @${handle}. ` : ''}
              Tracks you publish will now upload to your own Audius account.
            </p>
            <Button onClick={() => navigate('/creator-dashboard?tab=distribution')} className="rounded-lg">
              Back to Distribution
            </Button>
          </>
        )}

        {state === 'error' && (
          <>
            <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto mb-3" />
            <h1 className="text-lg font-bold text-foreground mb-2">Connection not completed</h1>
            <p className="text-sm text-muted-foreground mb-5">{message}</p>
            <Button
              variant="outline"
              onClick={() => navigate('/creator-dashboard?tab=distribution')}
              className="rounded-lg"
            >
              Back to Distribution
            </Button>
          </>
        )}
      </div>
    </div>
  );
}