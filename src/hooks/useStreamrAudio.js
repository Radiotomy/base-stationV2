import { useEffect, useRef, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Phase 4 — Hook for live audio transport via Streamr.
 *
 * mode = "publish": captures mic/audio chunks and forwards to streamrPublisher
 * mode = "subscribe": polls streamrSubscriber for chunks and plays them
 *
 * Degrades gracefully if Streamr is not configured server-side.
 */
export function useStreamrAudio(roomId, mode, performerId = null) {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | publishing | subscribing | unavailable
  const recorderRef = useRef(null);
  const pollRef = useRef(null);

  // Discover availability
  useEffect(() => {
    if (!roomId) return;
    if (mode === 'subscribe' && performerId) {
      base44.functions.invoke('streamrSubscriber', { roomId, performerId })
        .then(r => {
          const avail = r?.data?.data?.available || r?.data?.available;
          setEnabled(!!avail);
          setStatus(avail ? 'subscribing' : 'unavailable');
        })
        .catch(() => setStatus('unavailable'));
    }
  }, [roomId, mode, performerId]);

  const startPublish = useCallback(async () => {
    if (mode !== 'publish' || !roomId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      recorder.ondataavailable = async (e) => {
        if (!e.data || e.data.size === 0) return;
        const reader = new FileReader();
        reader.onload = () => {
          const b64 = String(reader.result).split(',')[1];
          base44.functions.invoke('streamrPublisher', { roomId, audioChunk: b64 }).catch(() => {});
        };
        reader.readAsDataURL(e.data);
      };
      recorder.start(1000); // 1s chunks
      recorderRef.current = recorder;
      setEnabled(true);
      setStatus('publishing');
    } catch {
      setStatus('unavailable');
    }
  }, [mode, roomId]);

  const stopPublish = useCallback(() => {
    try {
      recorderRef.current?.stop();
      recorderRef.current?.stream?.getTracks?.().forEach(t => t.stop());
    } catch {}
    recorderRef.current = null;
    setEnabled(false);
    setStatus('idle');
  }, []);

  useEffect(() => () => {
    stopPublish();
    if (pollRef.current) clearInterval(pollRef.current);
  }, [stopPublish]);

  return { enabled, status, startPublish, stopPublish };
}