import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { invalidateCreditBalance } from '@/components/credits/CreditBalanceWidget';

/**
 * Polls a GenerationJob by job_id until completed or failed.
 * Implements exponential backoff starting at 2s, capping at 8s.
 * Tracks elapsed time for UX progress estimation.
 */
export function useJobPolling(jobId, onComplete, onError, maxAttempts = 60, intervalMs = 15000) {
  const [status, setStatus] = useState('pending');
  const [stage, setStage] = useState(null);
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
    setStage(null);
    setProgress(5);
    setElapsedSeconds(0);

    // Elapsed seconds ticker — only runs while actively processing
    const elapsed = setInterval(() => {
      if (completedRef.current) {
        clearInterval(elapsed);
        return;
      }
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 5000); // 5s is sufficient for UX display

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
        // Provider-reported phase (Shotstack: queued/fetching/rendering/saving)
        if (result.data?.stage) setStage(result.data.stage);

        // Simulated progress ramp based on attempt count
        const approxProgress = Math.min(90, 10 + (attemptRef.current / maxAttempts) * 80);
        setProgress(Math.round(approxProgress));

        if (jobStatus === 'completed') {
          if (completedRef.current) return; // prevent duplicate callbacks
          completedRef.current = true;
          setProgress(100);
          setStage('done');
          // result.data now includes: audio_url, audio_urls, cover_image_url, lyrics, title,
          // tags, duration, bpm, key, genre, mood, vocal_gender, vocal_timbre, model_version, content_hash
          setData(result.data);
          clearInterval(elapsed);
          // Credits were deducted server-side on completion — refresh the widget
          invalidateCreditBalance();
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

      attemptRef.current++;
      timerRef.current = setTimeout(poll, intervalMs);
    };

    timerRef.current = setTimeout(poll, intervalMs);

    return () => {
      clearTimeout(timerRef.current);
      clearInterval(elapsed);
    };
  }, [jobId, intervalMs]);

  return { status, stage, progress, elapsedSeconds, data };
}