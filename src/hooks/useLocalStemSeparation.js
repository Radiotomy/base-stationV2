import { useCallback, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { audioBufferToWav } from '@/utils/wavEncoder';
import {
  loadSession,
  separate,
  estimateChunks,
  SOURCES,
  MODEL_SAMPLE_RATE,
} from '@/lib/stems/htdemucsOnnx';

/**
 * Runs htdemucs_6s in the tab and files the results through the normal
 * provenance path. Phases are surfaced separately because they fail for very
 * different reasons — a 136 MB model download failing is not the same problem
 * as inference running out of memory, and one progress bar would hide that.
 */
export default function useLocalStemSeparation() {
  const [phase, setPhase] = useState('idle'); // idle|model|decoding|separating|uploading|done
  const [progress, setProgress] = useState(0);
  const [chunkInfo, setChunkInfo] = useState(null);
  const [error, setError] = useState(null);
  const cancelled = useRef(false);

  const reset = useCallback(() => {
    cancelled.current = false;
    setError(null);
    setProgress(0);
    setChunkInfo(null);
  }, []);

  const run = useCallback(async (asset) => {
    reset();
    try {
      // ── 1. Model (cached by the browser after the first run) ──
      setPhase('model');
      const session = await loadSession(setProgress);

      // ── 2. Decode + resample to exactly what the graph expects ──
      setPhase('decoding');
      setProgress(0);
      const res = await fetch(asset.file_url);
      if (!res.ok) throw new Error('Could not read the source track');
      const raw = await res.arrayBuffer();

      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      let decoded = await ctx.decodeAudioData(raw);
      ctx.close();

      if (decoded.sampleRate !== MODEL_SAMPLE_RATE) {
        // The graph is trained and shaped for 44.1 kHz — feeding it anything
        // else silently pitches and mistimes every stem.
        const frames = Math.ceil(decoded.duration * MODEL_SAMPLE_RATE);
        const offline = new OfflineAudioContext(2, frames, MODEL_SAMPLE_RATE);
        const src = offline.createBufferSource();
        src.buffer = decoded;
        src.connect(offline.destination);
        src.start();
        decoded = await offline.startRendering();
      }

      const left = decoded.getChannelData(0);
      const right = decoded.numberOfChannels > 1 ? decoded.getChannelData(1) : left;
      const mix = [left, right.length === left.length ? right : left];

      // ── 3. Inference, chunk by chunk ──
      setPhase('separating');
      setProgress(0);
      setChunkInfo({ chunks: estimateChunks(left.length) });
      const rows = SOURCES.map((_, i) => i);
      const stems = await separate(session, mix, rows, setProgress);

      // ── 4. Encode + upload each stem ──
      setPhase('uploading');
      setProgress(0);
      const uploaded = [];
      for (let i = 0; i < SOURCES.length; i++) {
        const label = SOURCES[i];
        const buf = new AudioBuffer({
          length: stems[i][0].length,
          numberOfChannels: 2,
          sampleRate: MODEL_SAMPLE_RATE,
        });
        buf.copyToChannel(stems[i][0], 0);
        buf.copyToChannel(stems[i][1], 1);

        const blob = audioBufferToWav(buf, { bitDepth: 16 });
        const file = new File([blob], `${label}.wav`, { type: 'audio/wav' });
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        uploaded.push({ stem_type: label, label, file_url });

        // Release each stem as soon as it is uploaded — six full-length stereo
        // buffers held at once is the main memory risk on this path.
        stems[i] = null;
        setProgress((i + 1) / SOURCES.length);
      }

      const r = await base44.functions.invoke('finalizeLocalStems', {
        assetId: asset.id,
        stems: uploaded,
      });

      setPhase('done');
      return r.data?.stems || [];
    } catch (e) {
      setPhase('idle');
      setError(e?.message || 'On-device separation failed');
      throw e;
    }
  }, [reset]);

  return { run, phase, progress, chunkInfo, error };
}