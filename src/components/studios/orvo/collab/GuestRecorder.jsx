import { useState, useRef } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';

/**
 * Browser microphone capture for guest takes.
 * Hands the finished Blob (+ duration) back to the parent for upload.
 */
export default function GuestRecorder({ onComplete, disabled }) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [preparing, setPreparing] = useState(false);
  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const start = async () => {
    setPreparing(true);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream);
    chunksRef.current = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      clearInterval(timerRef.current);
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
      onComplete?.(blob, elapsed);
      setRecording(false);
      setElapsed(0);
    };
    recRef.current = rec;
    rec.start();
    setPreparing(false);
    setRecording(true);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  };

  const stop = () => recRef.current?.stop();

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <div className="text-center">
      <button
        disabled={disabled || preparing}
        onClick={recording ? stop : start}
        className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto transition-all disabled:opacity-50 ${
          recording ? 'bg-red-500/20 border-2 border-red-500 animate-pulse' : 'merc-button'
        }`}
      >
        {preparing ? <Loader2 className="w-7 h-7 animate-spin" />
          : recording ? <Square className="w-6 h-6 text-red-300" />
          : <Mic className="w-7 h-7" />}
      </button>
      <p className="text-sm font-mono text-white/60 mt-3">{mm}:{ss}</p>
      <p className="text-xs text-white/40 mt-1">
        {recording ? 'Recording — tap to stop' : 'Tap to start recording'}
      </p>
    </div>
  );
}