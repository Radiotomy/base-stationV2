import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Video, VideoOff, Mic, MicOff, Circle, Square, Loader2 } from 'lucide-react';

const btn = 'merc-button-dark rounded-full px-4 py-2 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50';

/**
 * Podcaster production console — camera/mic capture with local monitoring,
 * plus recording that is archived to the show as a draft episode when stopped.
 */
export default function BroadcastConsole({ event, onArchived }) {
  const { toast } = useToast();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [connected, setConnected] = useState(false);
  const [camOn, setCamOn] = useState(event.media_type === 'video');
  const [micOn, setMicOn] = useState(true);
  const [recording, setRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  const connect = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: event.media_type === 'video' ? { width: 1280, height: 720 } : false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.play().catch(() => {});
      }
      setConnected(true);
    } catch (e) {
      toast({ title: 'Could not access your devices', description: e.message, variant: 'destructive' });
    }
  };

  const toggleTrack = (kind) => {
    const tracks = kind === 'video' ? streamRef.current?.getVideoTracks() : streamRef.current?.getAudioTracks();
    if (!tracks?.length) return;
    const next = !tracks[0].enabled;
    tracks.forEach((t) => { t.enabled = next; });
    kind === 'video' ? setCamOn(next) : setMicOn(next);
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mime = event.media_type === 'video' ? 'video/webm' : 'audio/webm';
    const rec = new MediaRecorder(streamRef.current, MediaRecorder.isTypeSupported(mime) ? { mimeType: mime } : undefined);
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = archive;
    recorderRef.current = rec;
    rec.start(1000);
    setElapsed(0);
    setRecording(true);
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  const archive = async () => {
    setSaving(true);
    try {
      const ext = event.media_type === 'video' ? 'webm' : 'webm';
      const blob = new Blob(chunksRef.current, { type: event.media_type === 'video' ? 'video/webm' : 'audio/webm' });
      const file = new File([blob], `orvo-live-${event.id}.${ext}`, { type: blob.type });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      const episode = await base44.entities.Episode.create({
        podcast_id: event.podcast_id,
        user_id: event.host_id,
        title: `${event.title} (Live)`,
        description: 'Archived from a live ORVO broadcast.',
        audio_url: file_url,
        duration_seconds: elapsed,
        status: 'draft',
      });

      const updated = await base44.entities.OrvoLiveEvent.update(event.id, {
        recording_url: file_url,
        archived_episode_id: episode.id,
      });
      onArchived?.(updated);
      toast({ title: 'Session archived', description: 'Saved as a draft episode on your show.' });
    } catch (e) {
      toast({ title: 'Archive failed', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;

  return (
    <div className="merc-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-widest text-[#FF9A4D]">Broadcast console</p>
        {recording && <span className="text-xs font-black text-red-400 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />REC {mmss}</span>}
      </div>

      {event.media_type === 'video' && (
        <video ref={videoRef} playsInline className="w-full aspect-video bg-black rounded-xl object-cover" />
      )}

      <div className="flex flex-wrap gap-2">
        {!connected ? (
          <button onClick={connect} className="merc-button rounded-full px-5 py-2 text-xs font-black">
            Connect {event.media_type === 'video' ? 'camera & mic' : 'microphone'}
          </button>
        ) : (
          <>
            <button onClick={() => toggleTrack('audio')} className={btn}>
              {micOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />} {micOn ? 'Mic on' : 'Muted'}
            </button>
            {event.media_type === 'video' && (
              <button onClick={() => toggleTrack('video')} className={btn}>
                {camOn ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />} {camOn ? 'Camera on' : 'Camera off'}
              </button>
            )}
            {recording ? (
              <button onClick={stopRecording} className={btn}><Square className="w-3.5 h-3.5" /> Stop & archive</button>
            ) : (
              <button onClick={startRecording} disabled={saving} className="merc-button rounded-full px-5 py-2 text-xs font-black flex items-center gap-1.5">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Circle className="w-3.5 h-3.5" />} {saving ? 'Archiving…' : 'Record session'}
              </button>
            )}
          </>
        )}
      </div>

      <p className="text-[11px] text-white/35 leading-relaxed">
        Recording captures your local camera and microphone and saves it to your show as a draft episode.
        Audience delivery uses the stream link on the session.
      </p>
    </div>
  );
}