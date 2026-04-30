import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export function useJobPolling(jobId, onComplete, onError, pollInterval = 2000) {
  const [status, setStatus] = useState('pending');
  const [progress, setProgress] = useState(0);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!jobId) return;

    const pollJob = async () => {
      try {
        const result = await base44.functions.invoke('pollGenerationJob', { job_id: jobId });
        setStatus(result.status);

        if (result.status === 'completed') {
          setData(result);
          setProgress(100);
          onComplete?.(result);
        } else if (result.status === 'failed') {
          onError?.(result.error_message);
        } else {
          setProgress(50); // In progress
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    };

    // Poll immediately, then at intervals
    pollJob();
    const interval = setInterval(pollJob, pollInterval);

    return () => clearInterval(interval);
  }, [jobId, onComplete, onError, pollInterval]);

  return { status, progress, data };
}