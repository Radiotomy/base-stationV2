import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Mic, Loader2, CheckCircle2 } from 'lucide-react';
import GuestRecorder from '@/components/studios/orvo/collab/GuestRecorder';

// Public guest recording route — Phase 5.
export default function GuestRecording() {
  const { projectId: token } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await base44.functions.invoke('orvoCollaboration', { action: 'resolve', token })
        .catch(() => ({ data: { error: 'This invite link is no longer valid.' } }));
      if (!alive) return;
      if (res.data?.error) setError(res.data.error);
      else setInfo(res.data);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [token]);

  const handleRecording = async (blob, duration) => {
    setUploading(true);
    const file = new File([blob], `guest-take-${Date.now()}.webm`, { type: blob.type });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const res = await base44.functions.invoke('orvoCollaboration', {
      action: 'submitRecording',
      token,
      audio_url: file_url,
      duration_seconds: duration,
    });
    setUploading(false);
    if (res.data?.error) return toast({ title: 'Could not submit', description: res.data.error, variant: 'destructive' });
    setSubmitted(true);
    toast({ title: 'Take sent to the host 🎙️' });
  };

  const shell = (children) => (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: '#14100C' }}>
      <div className="merc-card rounded-2xl p-10 max-w-md w-full text-center">{children}</div>
    </div>
  );

  if (loading) return shell(<Loader2 className="w-7 h-7 animate-spin text-[#FF9A4D] mx-auto" />);

  if (error) {
    return shell(
      <>
        <h1 className="font-display text-xl text-white mb-2">Invite unavailable</h1>
        <p className="text-sm text-white/60 mb-6">{error}</p>
        <Link to="/" className="merc-button-dark rounded-full px-6 py-2 text-sm font-bold inline-block">BASE Station Home</Link>
      </>
    );
  }

  return shell(
    <>
      <div className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center bg-[#FF9A4D]/15 border border-[#FF9A4D]/30 overflow-hidden">
        {info?.podcast?.cover_image
          ? <img src={info.podcast.cover_image} alt="" className="w-full h-full object-cover" />
          : <Mic className="w-7 h-7 text-[#FF9A4D]" />}
      </div>
      <h1 className="font-display text-xl text-white mb-1">{info?.podcast?.title || 'Guest Recording'}</h1>
      <p className="text-sm text-white/60 mb-6">
        You've been invited as a {(info?.collaboration?.role || 'guest').replace('_', ' ')}
        {info?.podcast?.user_name ? ` by ${info.podcast.user_name}` : ''}. Record your side here — the host gets it instantly.
      </p>

      {!user ? (
        <Link
          to={`/login?returnTo=${encodeURIComponent(window.location.pathname)}`}
          className="merc-button rounded-full px-6 py-2 text-sm font-black inline-block"
        >
          Sign in to record
        </Link>
      ) : submitted ? (
        <div className="text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
          <p className="text-sm text-white/70 mb-4">Your take was delivered to the host.</p>
          <button onClick={() => setSubmitted(false)} className="merc-button-dark rounded-full px-5 py-2 text-xs font-bold">
            Record another
          </button>
        </div>
      ) : uploading ? (
        <div className="flex items-center justify-center gap-2 text-sm text-white/60">
          <Loader2 className="w-4 h-4 animate-spin" /> Sending your take…
        </div>
      ) : (
        <GuestRecorder onComplete={handleRecording} />
      )}
    </>
  );
}