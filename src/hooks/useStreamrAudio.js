import { useEffect, useRef, useState, useCallback } from 'react';
import { StreamrClient, EthereumKeyPairIdentity } from '@streamr/sdk';
import { base44 } from '@/api/base44Client';
import { STREAMR_CONFIG } from '@/config/streamrConfig';

/**
 * Phase 6 — Streamr browser-direct live-audio hook.
 *
 * Private keys never cross a trust boundary in the wrong direction:
 *   - The Streamr OWNER private key stays server-side (streamrAcquireStream).
 *   - The performer's PUBLISH key is generated in the browser and never sent
 *     anywhere — only its public address is sent to the server for a one-time
 *     on-chain PUBLISH grant. The browser then publishes frames straight onto
 *     the Streamr p2p network in real time.
 *   - Fans need NO key at all: the stream is public-read, so a bare
 *     `new StreamrClient()` (which generates a random identity) can subscribe.
 *
 * This eliminates both bugs of the old relay design:
 *   - No decodeAudioData / webm guessing — raw Float32 PCM is repackaged into
 *     an AudioBuffer and played back, deterministically.
 *   - No polling, no frame loss — subscribe is a real-time per-frame callback.
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
  const workletNodeRef = useRef(null);
  const gainRef = useRef(null);
  const clientRef = useRef(null);
  const subRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const mutedRef = useRef(false);
  const stoppedRef = useRef(false);
  const seqRef = useRef(0);
  const streamIdRef = useRef(null);

  const reportError = useCallback((message, err) => {
    base44.functions.invoke('logError', {
      component: 'live.streamr',
      message,
      stack: err?.stack || String(err || ''),
      context: { sessionId, role },
    }).catch(() => {});
  }, [sessionId, role]);

  const float32ToB64 = useCallback((f32) => {
    const bytes = new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength);
    const STEP = 0x8000;
    let bin = '';
    for (let i = 0; i < bytes.length; i += STEP) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + STEP));
    }
    return btoa(bin);
  }, []);

  const b64ToFloat32 = useCallback((b64) => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Float32Array(bytes.buffer);
  }, []);

  // ---------------- Publisher: mic -> AudioWorklet -> Streamr ----------------
  const startPublish = useCallback(async (mediaStream) => {
    if (role !== 'publisher' || !sessionId || !mediaStream) return;
    try {
      setStatus('connecting');
      stoppedRef.current = false;
      mediaStreamRef.current = mediaStream;

      // Gate: only the session owner / co-performers may publish.
      try {
        const gate = await base44.functions.invoke('canPublishToSession', { sessionId });
        if (!gate?.data?.allowed) {
          setStatus('error');
          reportError(`publish_not_allowed:${gate?.data?.reason || 'denied'}`);
          return;
        }
      } catch (e) {
        setStatus('error');
        reportError('publish_gate_failed', e);
        return;
      }

      // Ephemeral publishing identity: private key stays in the browser.
      const identity = await EthereumKeyPairIdentity.generate();
      const publisherAddress = await identity.getUserId();

      // Server creates the stream + grants PUBLISH to this address.
      const acquired = await base44.functions.invoke('streamrAcquireStream', {
        roomId: sessionId,
        publisherAddress,
      });
      if (!acquired?.data?.available || !acquired?.data?.streamId) {
        setStatus('unavailable');
        return;
      }
      const streamId = acquired.data.streamId;
      streamIdRef.current = streamId;

      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) { setStatus('unavailable'); return; }
      const ctx = new Ctx();
      audioContextRef.current = ctx;
      if (ctx.state === 'suspended') setAutoplayBlocked(true);

      await ctx.audioWorklet.addModule(new URL('../worklets/pcm-capture.js', import.meta.url));
      const src = ctx.createMediaStreamSource(mediaStream);
      sourceNodeRef.current = src;
      const worklet = new AudioWorkletNode(ctx, 'pcm-capture', {
        processorOptions: { targetMs: STREAMR_CONFIG.frameTargetMs },
      });
      workletNodeRef.current = worklet;
      src.connect(worklet);
      // Worklet output is intentionally not routed to speakers (no monitor).

      const pubClient = new StreamrClient({ auth: { identity } });
      clientRef.current = pubClient;

      worklet.port.onmessage = (ev) => {
        if (stoppedRef.current || mutedRef.current) return;
        const { samples, sr } = ev.data || {};
        if (!samples || samples.length === 0) return;
        pubClient.publish(streamId, {
          pcm: float32ToB64(samples),
          sr,
          seq: seqRef.current++,
          t: Date.now(),
        }).catch((e) => reportError('publish_frame_failed', e));
      };

      setStatus('live');
    } catch (err) {
      reportError('start_publish_failed', err);
      setStatus('error');
    }
  }, [role, sessionId, reportError, float32ToB64]);

  const setMuted = useCallback((muted) => {
    mutedRef.current = !!muted;
    try { mediaStreamRef.current?.getAudioTracks?.().forEach((t) => { t.enabled = !muted; }); } catch {}
    try { if (gainRef.current) gainRef.current.gain.value = muted ? 0 : 1; } catch {}
  }, []);

  // ---------------- Subscriber: Streamr -> AudioBuffer (real-time) ----------------
  const startSubscribe = useCallback(async () => {
    if (role !== 'subscriber' || !sessionId) return;
    try {
      setStatus('connecting');
      stoppedRef.current = false;

      // Fans locate the stream from the session record (written on acquire).
      const rows = await base44.entities.LiveSession.filter({ id: sessionId }).catch(() => []);
      const session = rows[0];
      if (!session) { setStatus('unavailable'); return; }
      const streamId = session.streamr_stream_id;
      if (!streamId) { setStatus('unavailable'); return; }
      streamIdRef.current = streamId;

      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) { setStatus('unavailable'); return; }
      const ctx = new Ctx();
      audioContextRef.current = ctx;
      if (ctx.state === 'suspended') setAutoplayBlocked(true);

      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      if (mutedRef.current) gain.gain.value = 0;
      gainRef.current = gain;

      // Public stream: no identity required — SDK generates a random one.
      const subClient = new StreamrClient();
      clientRef.current = subClient;

      const subscription = await subClient.subscribe(streamId, (message) => {
        if (stoppedRef.current) return;
        const payload = (message && typeof message.getContent === 'function')
          ? message.getContent()
          : (message && typeof message.content !== 'undefined' ? message.content : message);
        if (!payload || !payload.pcm) return;
        try {
          const f32 = b64ToFloat32(payload.pcm);
          const buf = ctx.createBuffer(1, f32.length, payload.sr || 48000);
          buf.getChannelData(0).set(f32);
          const node = ctx.createBufferSource();
          node.buffer = buf;
          node.connect(gain);
          node.start();
        } catch (e) { reportError('decode_chunk_failed', e); }
      });
      subRef.current = subscription;

      setStatus('live');
    } catch (err) {
      reportError('start_subscribe_failed', err);
      setStatus('error');
    }
  }, [role, sessionId, reportError, b64ToFloat32]);

  const resume = useCallback(async () => {
    try { await audioContextRef.current?.resume?.(); setAutoplayBlocked(false); } catch {}
  }, []);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    try { if (subRef.current) { try { subRef.current.unsubscribe?.(); } catch {} subRef.current = null; } } catch {}
    try { if (clientRef.current) { try { clientRef.current.destroy?.(); } catch {} clientRef.current = null; } } catch {}
    try { if (workletNodeRef.current) { try { workletNodeRef.current.port.onmessage = null; } catch {} try { workletNodeRef.current.disconnect(); } catch {} workletNodeRef.current = null; } } catch {}
    try { if (sourceNodeRef.current) { try { sourceNodeRef.current.disconnect(); } catch {} sourceNodeRef.current = null; } } catch {}
    try { if (gainRef.current) { try { gainRef.current.disconnect(); } catch {} gainRef.current = null; } } catch {}
    try { if (audioContextRef.current) { try { audioContextRef.current.close(); } catch {} audioContextRef.current = null; } } catch {}
    try { if (mediaStreamRef.current) { try { mediaStreamRef.current.getTracks().forEach((t) => t.stop()); } catch {} mediaStreamRef.current = null; } } catch {}
    setStatus('idle');
    setAutoplayBlocked(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  return {
    status,
    autoplayBlocked,
    streamId: streamIdRef.current,
    audioContextRef,
    sourceNodeRef,
    startPublish,
    startSubscribe,
    setMuted,
    resume,
    stop,
  };
}