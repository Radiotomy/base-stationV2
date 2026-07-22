import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Voice dictation for the Manual Writer — sing or speak lyrics, structure
 * notes, ideas… records the mic, transcribes it, and hands back the text.
 */
export default function VoiceDictation({ onTranscript }) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    if (mediaRef.current?.state === 'recording') mediaRef.current.stop();
  }, []);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        clearInterval(timerRef.current);
        setRecording(false);
        setProcessing(true);
        try {
          const blob = new Blob(chunksRef.current, { type: mime });
          const file = new File([blob], `dictation.${mime.includes('mp4') ? 'm4a' : 'webm'}`, { type: mime });
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          const transcript = await base44.integrations.Core.TranscribeAudio({ audio_url: file_url });
          if (typeof transcript === 'string' && transcript.trim()) {
            onTranscript(transcript.trim());
            toast.success('🎙️ Transcribed — added to your lyrics');
          } else {
            toast.error("Couldn't hear anything — try again closer to the mic");
          }
        } catch (err) {
          toast.error(err?.message || 'Transcription failed');
        }
        setProcessing(false);
        setElapsed(0);
      };
      rec.start();
      mediaRef.current = rec;
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    } catch {
      toast.error('Microphone blocked — allow mic access in your browser settings');
    }
  };

  const stop = () => {
    if (mediaRef.current && mediaRef.current.state !== 'inactive') mediaRef.current.stop();
  };

  const mmss = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;

  return (
    <div className="space-y-1.5">
      <Button
        size="sm"
        onClick={recording ? stop : start}
        disabled={processing}
        className={`w-full rounded-xl gap-1.5 text-xs h-10 font-bold ${recording
          ? 'bg-red-600 hover:bg-red-500 text-white'
          : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
      >
        {processing ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Transcribing…</>
        ) : recording ? (
          <><Square className="w-3.5 h-3.5 fill-current" /> Stop &amp; Transcribe · {mmss}</>
        ) : (
          <><Mic className="w-4 h-4" /> Sing or Speak Your Lyrics</>
        )}
      </Button>
      {recording && (
        <p className="text-[10px] text-red-300/80 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          Recording — sing melodies, dictate verses, call out structure ("chorus…"), or leave notes.
        </p>
      )}
    </div>
  );
}