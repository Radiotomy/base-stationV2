import { useState, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Opt-in training telemetry, shared by every generation tab so each provider
 * records the same shape — that consistency is what makes cross-provider rows
 * comparable instead of just parallel usage logs.
 *
 * Consent is enforced on the server, so callers fire these unconditionally.
 * Every call is failure-silent: telemetry must never break a generation.
 */
export function useTrainingTelemetry() {
  const [sampleId, setSampleId] = useState(null);
  const sampleRef = useRef(null);

  const logGeneration = useCallback(async (payload) => {
    try {
      const res = await base44.functions.invoke('logTrainingSample', payload);
      const id = res.data?.sample_id || null;
      sampleRef.current = id;
      setSampleId(id);
      return id;
    } catch { return null; }
  }, []);

  const updateSample = useCallback(async (patch) => {
    const id = sampleRef.current;
    if (!id) return;
    try {
      await base44.functions.invoke('logTrainingSample', { sample_id: id, ...patch });
    } catch { /* ignore */ }
  }, []);

  // Starting a new generation while the previous one was never saved is the
  // clearest implicit "that wasn't it" signal available.
  const markRegenerated = useCallback(() => {
    if (sampleRef.current) updateSample({ outcome: 'regenerated' });
    sampleRef.current = null;
    setSampleId(null);
  }, [updateSample]);

  return { sampleId, logGeneration, updateSample, markRegenerated };
}