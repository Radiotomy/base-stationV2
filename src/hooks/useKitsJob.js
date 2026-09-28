import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';

/** Start a Kits render and poll it through the shared 1-per-minute queue. */
export default function useKitsJob() {
  const [state, setState] = useState({ status: 'idle' });
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const poll = async (jobId) => {
    const { data } = await base44.functions.invoke('pollKitsJob', { job_id: jobId });
    setState({ ...data, jobId });
    if (data.status === 'pending' || data.status === 'processing') {
      timer.current = setTimeout(() => poll(jobId).catch((e) => setState({ status: 'failed', error: e.message })), 5000);
    }
  };

  const start = async (fn, payload) => {
    clearTimeout(timer.current);
    setState({ status: 'pending' });
    try {
      const { data } = await base44.functions.invoke(fn, payload);
      setState({ status: data.status, queue: data.queue, jobId: data.job_id });
      timer.current = setTimeout(() => poll(data.job_id), 4000);
    } catch (e) {
      setState({ status: 'failed', error: e?.response?.data?.error || e.message });
    }
  };

  const busy = state.status === 'pending' || state.status === 'processing';
  return { ...state, busy, start, reset: () => setState({ status: 'idle' }) };
}