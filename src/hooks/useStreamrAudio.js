import { useEffect, useRef, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { STREAMR_CONFIG, getStreamIdForSession } from '@/config/streamrConfig';

/**
 * Phase 5.8 — Streamr live-audio hook (browser-safe relay client).
 *
 * The Streamr private key never enters the browser. All Streamr traffic flows
 * through backend functions:
 *   - streamrPublisher  (creator → server → Streamr)
 *   - streamrSubscriber (server → Streamr; returns latest chunk)
 *   - streamrAvailability (server reports whether the key is configured)
 *
 * Usage:
 *   const streamr = useStreamrAudio({ sessionId, role: 'publisher' | 'subscriber' });
 *   await streamr.startPublish(mediaStream);   // role==='publisher'
 *   await streamr.startSubscribe();            // role==='subscriber'
 *   streamr.setMuted(true);
 *   streamr.stop();
 *
 * status: 'idle' | 'connecting' | 'live' | 'error' | 'unavailable'
 */
export function useStreamrAudio({ sessionId, role } = {}) {
  const [status, setStatus] = useState('idle');
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const processorRef = useRef(null);
  const recorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const mutedRef = useRef(false);
  const stoppedRef = useRef(false);

  const reportError = useCallback((message, err) => {
    // Non-blocking error log
    base44.functions.invoke('logError', {
      component: 'live.streamr',
      message,
      stack: err?.stack || String(err || ''),
      context: { sessionId, role },
    }).catch(() => {});
  }, [sessionId, role]);

  // -------- Publisher: mic → MediaRecorder chunks → streamrPublisher --------
  const startPublish = useCallback(async (mediaStream) => {
    if (role !== 'publisher' || !sessionId || !mediaStream) return;
    try {
      setStatus('connecting');
      stoppedRef.current = false;
      mediaStreamRef.current = mediaStream;

      // Gate publishing server-side (owner + co-performers only).
      try {
        const gate = await base44.functions.invoke('canPublishToSession', { sessionId });
        const allowed = gate?.data?.allowed;
        if (!allowed) {
          setStatus('error');
          reportError(`publish_not_allowed:${gate?.data?.reason || 'denied'}`);
          return;
        }
      } catch (e) {
        // If the gate itself fails, treat as error.
        setStatus('error');
        reportError('publish_gate_failed', e);
        return;
      }

      // Local AudioContext (used by visualizer + monitor-less analysis).
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        audioContextRef.current = new Ctx();
        try {
          sourceNodeRef.current = audioContextRef.current.createMediaStreamSource(mediaStream);
        } catch { /* analyzer is optional */ }
      }

      // Capture audio chunks via MediaRecorder (Opus webm — broadly supported).
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(mediaStream, { mimeType: mime });
      recorderRef.current = recorder;

      recorder.ondataavailable = async (e) => {
        if (mutedRef.current || !e.data || e.data.size === 0) return;
        try {
          const reader = new FileReader();
          reader.onload = () => {
            const b64 = String(reader.result).split(',')[1];
            base44.functions.invoke('streamrPublisher', {
              roomId: sessionId,
              audioChunk: b64,
              codec: 'opus',
            }).catch(() => {});
          };
          reader.readAsDataURL(e.data);
        } catch (err) { reportError('publish_chunk_failed', err); }
      };

      recorder.start(STREAMR_CONFIG.publishChunkMs);
      setStatus('live');
    } catch (err) {
      reportError('start_publish_failed', err);
      setStatus('error');
    }
  }, [role, sessionId, reportError]);

  const setMuted = useCallback((muted) => {
    mutedRef.current = !!muted;
    try {
      mediaStreamRef.current?.getAudioTracks?.().forEach(t => { t.enabled = !muted; });
    } catch {}
  }, []);

  // -------- Subscriber: poll streamrSubscriber → decode → AudioContext --------
  const startSubscribe = useCallback(async () => {
    if (role !== 'subscriber' || !sessionId) return;
    try {
      setStatus('connecting');
      stoppedRef.current = false;

      // Check availability via the session owner.
      const rows = await base44.entities.LiveSession.filter({ id: sessionId }).catch(() => []);
      const session = rows[0];
      if (!session) { setStatus('unavailable'); return; }

      const probe = await base44.functions.invoke('streamrSubscriber', {
        roomId: sessionId,
        performerId: session.user_id,
      }).catch(() => null);
      const available = probe?.data?.data?.available ?? probe?.data?.available;
      if (!available) {
        setStatus('unavailable');
        return;
      }

      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) { setStatus('unavailable'); return; }
      audioContextRef.current = new Ctx();
      const audioContext = audioContextRef.current;

      // Browsers may suspend the context until user gesture.
      if (audioContext.state === 'suspended') {
        setAutoplayBlocked(true);
      }

      let lastTs = 0;
      const playChunk = async (b64) => {
        try {
          const bin = atob(b64);
          const arr = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          const buf = await audioContext.decodeAudioData(arr.buffer.slice(0));
          const src = audioContext.createBufferSource();
          src.buffer = buf;
          src.connect(audioContext.destination);
          src.start();
        } catch (err) { reportError('decode_chunk_failed', err); }
      };

      pollIntervalRef.current = setInterval(async () => {
        if (stoppedRef.current) return;
        try {
          const r = await base44.functions.invoke('streamrSubscriber', {
            roomId: sessionId,
            performerId: session.user_id,
          });
          const chunk = r?.data?.data?.chunk ?? r?.data?.chunk;
          const ts = r?.data?.data?.ts ?? r?.data?.ts ?? 0;
          if (chunk && ts !== lastTs) {
            lastTs = ts;
            playChunk(chunk);
          }
        } catch { /* transient — keep polling */ }
      }, STREAMR_CONFIG.subscribePollMs);

      setStatus('live');
    } catch (err) {
      reportError('start_subscribe_failed', err);
      setStatus('error');
    }
  }, [role, sessionId, reportError]);

  const resume = useCallback(async () => {
    try {
      await audioContextRef.current?.resume?.();
      setAutoplayBlocked(false);
    } catch {}
  }, []);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    try {
      if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
      if (recorderRef.current) {
        try { recorderRef.current.stop(); } catch {}
        recorderRef.current = null;
      }
      if (mediaStreamRef.current) {
        try { mediaStreamRef.current.getTracks().forEach(t => t.stop()); } catch {}
        mediaStreamRef.current = null;
      }
      if (processorRef.current) { try { processorRef.current.disconnect(); } catch {} processorRef.current = null; }
      if (sourceNodeRef.current) { try { sourceNodeRef.current.disconnect(); } catch {} sourceNodeRef.current = null; }
      if (audioContextRef.current) { try { audioContextRef.current.close(); } catch {} audioContextRef.current = null; }
      setStatus('idle');
      setAutoplayBlocked(false);
    } catch (err) { reportError('stop_failed', err); }
  }, [reportError]);

  useEffect(() => () => stop(), [stop]);

  return {
    status,
    autoplayBlocked,
    streamId: sessionId ? getStreamIdForSession(sessionId) : null,
    audioContextRef,
    sourceNodeRef,
    startPublish,
    startSubscribe,
    setMuted,
    resume,
    stop,
  };
}