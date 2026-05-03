import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Polls a GenerationJob by job_id until completed or failed.
 * Implements exponential backoff starting at 2s, capping at 8s.
 * Tracks elapsed time for UX progress estimation.
 */
export function useJobPolling(jobId, onComplete, onError, maxAttempts = 60) {
  const [status, setStatus] = useState('pending');
  const [progress, setProgress] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [data, setData] = useState(null);
  const attemptRef = useRef(0);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const completedRef = useRef(false);
  // Keep callbacks in refs so polling loop always uses latest without re-triggering effect
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!jobId) return;
    attemptRef.current = 0;
    completedRef.current = false;
    startTimeRef.current = Date.now();
    setStatus('processing');
    setProgress(5);
    setElapsedSeconds(0);

    // Elapsed seconds ticker
    const elapsed = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    const poll = async () => {
      if (attemptRef.current >= maxAttempts) {
        setStatus('failed');
        clearInterval(elapsed);
        onError?.('Generation timed out after ' + maxAttempts + ' attempts');
        return;
      }

      try {
        const result = await base44.functions.invoke('pollGenerationJob', { job_id: jobId });
        const jobStatus = result.data?.status || result.status;
        setStatus(jobStatus);

        // Simulated progress ramp based on attempt count
        const approxProgress = Math.min(90, 10 + (attemptRef.current / maxAttempts) * 80);
        setProgress(Math.round(approxProgress));

        if (jobStatus === 'completed') {
          if (completedRef.current) return; // prevent duplicate callbacks
          completedRef.current = true;
          setProgress(100);
          setData(result.data);
          clearInterval(elapsed);
          onCompleteRef.current?.(result.data);
          return;
        } else if (jobStatus === 'failed') {
          clearInterval(elapsed);
          onErrorRef.current?.(result.data?.error_message || 'Generation failed');
          return;
        }
      } catch (err) {
        // Network error — keep retrying
        console.warn('Polling error (will retry):', err.message);
      }

      // Exponential backoff: 2s → 4s → 8s → 8s…
      attemptRef.current++;
      const delay = Math.min(8000, 2000 * Math.pow(1.4, Math.min(attemptRef.current, 5)));
      timerRef.current = setTimeout(poll, delay);
    };

    timerRef.current = setTimeout(poll, 2000);

    return () => {
      clearTimeout(timerRef.current);
      clearInterval(elapsed);
    };
  }, [jobId]);

  return { status, progress, elapsedSeconds, data };
}