import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TOUR_KEY = 'bs_guided_tour_complete_v1';
const ONBOARDING_KEY = 'bs_onboarding_complete_v1';

const STEPS = [
  {
    id: 'studios',
    target: '[data-tour="studios"]',
    emoji: '🎛️',
    title: 'Studios — where everything is made',
    description: 'Music, lyrics, cover art, mastering, videos and more. Every creative tool lives in one hub, organized by what you want to do.',
    cta: { label: 'Open Studios', to: '/studios' },
  },
  {
    id: 'workspace',
    target: '[data-tour="workspace"]',
    emoji: '📊',
    title: 'My Workspace — your home base',
    description: 'Everything you create is saved here automatically: your library, projects, stats, generation history and fan economy.',
    cta: { label: 'Open Workspace', to: '/creator-dashboard' },
  },
  {
    id: 'submit',
    target: null,
    emoji: '📤',
    title: 'Submit — get your music heard',
    description: 'When a track is ready, submit it to the public charts and radio. Fans can play, like, and vote it up the leaderboard.',
    cta: { label: 'See Submit Page', to: '/submit' },
  },
  {
    id: 'proof',
    target: null,
    emoji: '🛡️',
    title: 'Proof of Ownership — free, one click',
    description: 'Permanently register your track\'s provenance on the blockchain — no wallet, no crypto, no fees. Find it in My Workspace under the Proof tab.',
    cta: { label: 'View Proof Tab', to: '/creator-dashboard?tab=proof' },
  },
  {
    id: 'help',
    target: '[data-tour="help"]',
    emoji: '📚',
    title: 'Help is always one click away',
    description: 'Step-by-step guides, pro tips, and a full reference for every studio. You\'re all set — go make something!',
    cta: null,
  },
];

export default function GuidedTour() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);
  const navigate = useNavigate();

  // Start conditions: fired right after onboarding finishes, or once for any
  // signed-in user who hasn't seen it (delayed so the page settles first).
  useEffect(() => {
    if (localStorage.getItem(TOUR_KEY)) return;

    const start = () => { setStep(0); setActive(true); };
    const onOnboardingDone = () => setTimeout(start, 600);
    window.addEventListener('bs:onboarding-finished', onOnboardingDone);

    let timer;
    (async () => {
      try {
        const user = await base44.auth.me();
        // Already completed or opted out on ANY device — the flag lives on the
        // account, so a new browser must not restart a finished tour.
        if (user?.tour_complete || user?.tour_opted_out) {
          localStorage.setItem(TOUR_KEY, '1');
          return;
        }
        const onboarded = user?.onboarding_complete || localStorage.getItem(ONBOARDING_KEY);
        const isNew = user?.created_date && (Date.now() - new Date(user.created_date).getTime()) < 7 * 24 * 60 * 60 * 1000;
        // New users who haven't onboarded yet will get the tour via the event instead
        if (isNew && !onboarded) return;
        timer = setTimeout(start, 1500);
      } catch { /* not signed in */ }
    })();

    return () => {
      window.removeEventListener('bs:onboarding-finished', onOnboardingDone);
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Measure the current step's spotlight target
  const measure = useCallback(() => {
    const sel = STEPS[step]?.target;
    if (!sel) { setRect(null); return; }
    const el = document.querySelector(sel);
    if (el && el.offsetParent !== null) {
      const r = el.getBoundingClientRect();
      if (r.width > 0) { setRect(r); return; }
    }
    setRect(null);
  }, [step]);

  useEffect(() => {
    if (!active) return;
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [active, measure]);

  // One flag write covers both endings: completing it and opting out both mean
  // "never show this again", so the tour can only ever run once per account.
  const finish = async (optedOut = false) => {
    localStorage.setItem(TOUR_KEY, '1');
    setActive(false);
    try {
      await base44.auth.updateMe(
        optedOut ? { tour_complete: true, tour_opted_out: true } : { tour_complete: true }
      );
    } catch {}
  };

  const goTo = (to) => { finish(); navigate(to); };

  if (!active) return null;
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  // Card position: near the spotlight if there is one, otherwise centered
  const cardW = 360;
  const cardStyle = rect
    ? {
        position: 'fixed',
        top: Math.min(rect.bottom + 14, window.innerHeight - 320),
        left: Math.min(Math.max(rect.left - 20, 16), window.innerWidth - cardW - 16),
        width: Math.min(cardW, window.innerWidth - 32),
      }
    : {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: Math.min(cardW, window.innerWidth - 32),
      };

  return (
    <AnimatePresence>
      <motion.div key="tour" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[95]">
        {/* Overlay — spotlight cutout when a target exists, plain dim otherwise */}
        {rect ? (
          <div
            className="fixed rounded-xl border-2 border-[#FF9A4D] pointer-events-none transition-all duration-300"
            style={{
              top: rect.top - 6, left: rect.left - 6,
              width: rect.width + 12, height: rect.height + 12,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.78), 0 0 20px rgba(255,154,77,0.5)',
            }}
          />
        ) : (
          <div className="fixed inset-0 bg-black/78" style={{ backgroundColor: 'rgba(0,0,0,0.78)' }} />
        )}

        {/* Step card */}
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          style={cardStyle}
          className="merc-card rounded-2xl p-5 shadow-2xl"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">{current.emoji}</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-400">
              Tour · {step + 1} of {STEPS.length}
            </span>
          </div>
          <h3 className="font-black text-foreground text-lg leading-tight mb-1.5">{current.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">{current.description}</p>

          {current.cta && (
            <button
              onClick={() => goTo(current.cta.to)}
              className="text-xs font-bold text-[#FF9A4D] hover:text-white transition-colors mb-4 block"
            >
              {current.cta.label} →
            </button>
          )}

          <div className="flex items-center justify-between gap-2">
            <button onClick={() => finish(true)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Skip — don't show again
            </button>
            <div className="flex gap-2">
              {step > 0 && (
                <Button size="sm" variant="outline" className="rounded-lg gap-1 text-xs" onClick={() => setStep(step - 1)}>
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </Button>
              )}
              <Button size="sm" className="rounded-lg gap-1 text-xs merc-button font-bold"
                onClick={() => (isLast ? finish(false) : setStep(step + 1))}>
                {isLast ? (<><Check className="w-3.5 h-3.5" /> Done</>) : (<>Next <ArrowRight className="w-3.5 h-3.5" /></>)}
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}