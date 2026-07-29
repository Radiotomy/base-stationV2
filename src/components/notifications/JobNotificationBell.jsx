import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCircle2, XCircle, Loader2, Music, Sparkles, Library, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

// Job types we watch — cover song + mastering jobs.
// Mastering jobs run through job_type='music' with provider='sonic' too, so we
// distinguish them by input_data.task_kind.
const WATCHED_TASK_KINDS = new Set([
  'cover_upload_music',
  'cover_song',
  'master',
  'mastering',
  'remaster',
]);

const POLL_INTERVAL_MS = 8000;
// When nothing is processing, back off to a slow heartbeat instead of
// hammering the server every 8s on every page.
const IDLE_POLL_INTERVAL_MS = 60000;
// After this many seconds of "processing", the bell starts driving the
// provider poll itself. Covers the case where the user left the studio page
// and the in-page polling loop was torn down.
const DRIVE_POLL_AFTER_SECONDS = 90;
// Stop driving after this many minutes — anything still processing is hung.
const GIVE_UP_AFTER_MINUTES = 10;

function describeJob(job) {
  const kind = job.input_data?.task_kind || '';
  if (kind.includes('cover')) {
    return {
      type: 'Cover Song',
      icon: Music,
      title: job.input_data?.title || job.output_metadata?.title || 'Untitled Cover',
    };
  }
  if (kind.includes('master') || kind === 'remaster') {
    return {
      type: 'Mastered Track',
      icon: Sparkles,
      title: job.input_data?.title || job.output_metadata?.title || 'Mastered Track',
    };
  }
  return {
    type: 'Track',
    icon: Music,
    title: job.input_data?.title || 'Track',
  };
}

export default function JobNotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]); // { id, status, title, type, icon, completedAt, read, fileUrl }
  const [activeCount, setActiveCount] = useState(0);
  const seenStatusRef = useRef(new Map()); // job_id -> last known status
  const drivingRef = useRef(new Set()); // job_ids currently being driven (prevents concurrent invokes)
  const userIdRef = useRef(null);

  // Load current user once
  useEffect(() => {
    base44.auth.me().then(u => { userIdRef.current = u.id; }).catch(() => {});
  }, []);

  // Poll user's recent jobs and detect transitions
  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      if (!userIdRef.current) return false;
      // Background tabs don't need job updates — skip the query entirely so a
      // stack of open tabs isn't each running an entity fetch loop.
      if (typeof document !== 'undefined' && document.hidden) return false;
      try {
        const jobs = await base44.entities.GenerationJob.filter(
          { user_id: userIdRef.current },
          '-created_date',
          20
        );

        if (cancelled) return false;

        const watched = jobs.filter(j =>
          WATCHED_TASK_KINDS.has(j.input_data?.task_kind || '')
        );

        // Count currently-processing watched jobs (for the pulsing dot)
        const processing = watched.filter(j => j.status === 'processing' || j.status === 'pending');
        setActiveCount(processing.length);

        // Watchdog: for any job that's been processing > DRIVE_POLL_AFTER_SECONDS,
        // drive the provider poll ourselves. This rescues jobs whose studio page
        // was closed before completion.
        for (const job of processing) {
          if (!job.provider_job_id) continue; // not yet submitted to provider
          if (drivingRef.current.has(job.id)) continue;
          const ageSec = (Date.now() - new Date(job.created_date).getTime()) / 1000;
          if (ageSec < DRIVE_POLL_AFTER_SECONDS) continue;
          if (ageSec > GIVE_UP_AFTER_MINUTES * 60) continue; // hung — leave for cleanup
          drivingRef.current.add(job.id);
          base44.functions.invoke('pollGenerationJob', { job_id: job.id })
            .catch(() => {})
            .finally(() => { drivingRef.current.delete(job.id); });
        }

        // Detect status transitions → completed/failed
        for (const job of watched) {
          const prev = seenStatusRef.current.get(job.id);
          const curr = job.status;
          seenStatusRef.current.set(job.id, curr);

          // First time we see this job, just record its status (don't ping for
          // already-finished old jobs on mount)
          if (prev === undefined) continue;

          if (prev !== curr && (curr === 'completed' || curr === 'failed')) {
            const meta = describeJob(job);
            const fileUrl = job.output_url || null;

            setNotifications(prev => [{
              id: job.id,
              status: curr,
              type: meta.type,
              title: meta.title,
              icon: meta.icon,
              completedAt: Date.now(),
              read: false,
              fileUrl,
              errorMessage: job.error_message,
            }, ...prev].slice(0, 10));

            // Surface toast immediately so the user sees it even if the bell is closed
            if (curr === 'completed') {
              toast.success(`${meta.type} ready: ${meta.title}`, {
                icon: '✨',
                duration: 8000,
                action: { label: 'Library', onClick: () => { window.location.href = '/asset-gallery'; } },
              });
            } else {
              toast.error(`${meta.type} failed: ${meta.title}`, {
                description: job.error_message || 'Generation could not complete',
                duration: 10000,
              });
            }
          }
        }
        return processing.length > 0;
      } catch (err) {
        // Silent — keep polling
        console.warn('Job notification poll failed:', err.message);
        return false;
      }
    };

    // Adaptive polling: fast while jobs are processing, slow heartbeat when idle
    let timer = null;
    const loop = async () => {
      const hasActive = await tick();
      if (cancelled) return;
      timer = setTimeout(loop, hasActive ? POLL_INTERVAL_MS : IDLE_POLL_INTERVAL_MS);
    };
    loop();

    // Coming back to the tab should refresh immediately rather than waiting out
    // the remaining idle interval.
    const onVisible = () => {
      if (!document.hidden && !cancelled) {
        if (timer) clearTimeout(timer);
        loop();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;
  const showDot = unreadCount > 0 || activeCount > 0;

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const handleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next) markAllRead();
  };

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        title="Job notifications"
        className="relative w-9 h-9 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/5 border border-white/10 transition-all"
      >
        <Bell className="w-4 h-4" />
        {showDot && (
          <span className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${
            activeCount > 0
              ? 'bg-amber-400 animate-pulse'
              : 'bg-emerald-400'
          }`} />
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop to close on outside click */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="merc-card absolute right-0 mt-2 w-80 rounded-2xl overflow-hidden z-50"
            >
              <div className="p-3 border-b border-white/10 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-white">Job Notifications</p>
                  {activeCount > 0 ? (
                    <p className="text-[11px] text-amber-300 flex items-center gap-1.5 mt-0.5">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {activeCount} processing
                    </p>
                  ) : (
                    <p className="text-[11px] text-white/50 mt-0.5">
                      Cover song & mastering updates
                    </p>
                  )}
                </div>
                {notifications.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="text-[11px] text-white/40 hover:text-white/80 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center">
                    <Bell className="w-8 h-8 mx-auto text-white/20 mb-2" />
                    <p className="text-xs text-white/50">No notifications yet</p>
                    <p className="text-[10px] text-white/30 mt-1">
                      You'll be pinged when a cover or mastering job finishes
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {notifications.map(n => {
                      const Icon = n.icon;
                      const isDone = n.status === 'completed';
                      return (
                        <div key={n.id} className="p-3 hover:bg-white/5 transition-colors">
                          <div className="flex items-start gap-2.5">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              isDone ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'
                            }`}>
                              {isDone ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <Icon className="w-3 h-3 text-white/40" />
                                <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold">
                                  {n.type}
                                </p>
                                <span className={`text-[10px] font-bold ml-auto ${
                                  isDone ? 'text-emerald-300' : 'text-rose-300'
                                }`}>
                                  {isDone ? 'READY' : 'FAILED'}
                                </span>
                              </div>
                              <p className="text-sm font-bold text-white truncate mt-0.5">
                                {n.title}
                              </p>
                              {!isDone && n.errorMessage && (
                                <p className="text-[11px] text-rose-300/80 mt-1 line-clamp-2">
                                  {n.errorMessage}
                                </p>
                              )}
                              {isDone && (
                                <div className="flex gap-2 mt-2">
                                  <Link
                                    to="/asset-gallery"
                                    onClick={() => setOpen(false)}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 hover:text-emerald-200"
                                  >
                                    <Library className="w-3 h-3" /> Open Library
                                  </Link>
                                  {n.fileUrl && (
                                    <a
                                      href={n.fileUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 text-[11px] font-bold text-white/60 hover:text-white"
                                    >
                                      <ExternalLink className="w-3 h-3" /> Preview
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}