import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { invalidateCreditBalance } from '@/components/credits/CreditBalanceWidget';
import { pollJob, POLL_PROFILES } from '@/lib/polling/pollJob';

/**
 * Watches a GenerationJob until it settles.
 *
 * Cadence and the giving-up rule come from the shared polling policy rather than
 * from arguments here — see src/lib/polling/pollJob.js for why a ramped delay and
 * a wall-clock deadline replaced a flat interval and an attempt count.
 *
 * `maxAttempts` and `intervalMs` are still accepted so existing callers keep
 * working, but they are deliberately ignored: an attempt count says nothing
 * about elapsed time once the delay ramps, and letting each studio pick its own
 * interval is what put the app under provider rate pressure in the first place.
 */
export function useJobPolling(jobId, onComplete, onError, _maxAttempts, _intervalMs) {
  const [status, setStatus] = useState('pending');
  const [stage, setStage] = useState(null);
  const [progress, setProgress] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [data, setData] = useState(null);
  // Callbacks live in refs so a re-render never restarts the watch.
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!jobId) return;
    setStatus('processing');
    setStage(null);
    setProgress(5);
    setElapsedSeconds(0);

    const startedAt = Date.now();
    const deadline = POLL_PROFILES.music.deadlineMs;

    // Progress is derived from elapsed time, not from how many times we asked —
    // with a ramped delay those two have nothing to do with each other.
    const ticker = setInterval(() => {
      const ms = Date.now() - startedAt;
      setElapsedSeconds(Math.floor(ms / 1000));
      setProgress(Math.min(90, 5 + Math.round((ms / deadline) * 170)));
    }, 5000);

    const watch = pollJob(async () => {
      const result = await base44.functions.invoke('pollGenerationJob', { job_id: jobId });
      const payload = result.data || {};
      if (payload.stage) setStage(payload.stage);
      return payload;
    }, 'music');

    watch.promise.then(({ outcome, data: payload, error }) => {
      clearInterval(ticker);
      if (outcome === 'completed') {
        setStatus('completed');
        setProgress(100);
        setStage('done');
        setData(payload);
        // Credits are deducted server-side at finalize — refresh the widget.
        invalidateCreditBalance();
        onCompleteRef.current?.(payload);
        return;
      }
      if (outcome === 'failed') {
        setStatus('failed');
        onErrorRef.current?.(error || 'Generation failed');
        return;
      }
      // Timed out watching. The render is still running server-side and will
      // land in the library on its own, so say that rather than calling it dead.
      setStatus('processing');
      onErrorRef.current?.('Still rendering — this one is taking a while. It will appear in your library when it finishes.');
    });

    return () => {
      watch.cancel();
      clearInterval(ticker);
    };
  }, [jobId]);

  return { status, stage, progress, elapsedSeconds, data };
}