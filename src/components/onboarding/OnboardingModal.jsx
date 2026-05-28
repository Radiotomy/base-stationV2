import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Music, Radio, ArrowRight, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const STORAGE_KEY = 'bs_onboarding_complete_v1';

const STEPS = [
  {
    title: 'Welcome to BASE Station 🎛️',
    description: 'The AI-first music studio + community. Create, share, and discover music made by humans + AI.',
    icon: Sparkles,
    gradient: 'from-purple-600 to-pink-600',
    visual: '🎶',
  },
  {
    title: 'Create in any studio',
    description: 'Generate music, lyrics, cover art, videos, stems & more — all in one place. Your library is automatically saved.',
    icon: Music,
    gradient: 'from-blue-600 to-cyan-600',
    visual: '🎨',
    cta: { label: 'Try AI Studio', to: '/ai-studio' },
  },
  {
    title: 'Get on the radio',
    description: 'Submit your tracks for airplay alongside Audius hits, enter weekly challenges, and climb the charts.',
    icon: Radio,
    gradient: 'from-emerald-600 to-teal-600',
    visual: '📡',
    cta: { label: 'Submit a Track', to: '/submit' },
  },
];

export default function OnboardingModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Skip if already completed (local) or shown before
        if (localStorage.getItem(STORAGE_KEY)) return;
        const user = await base44.auth.me();
        if (cancelled) return;
        // Only show for genuinely new users — created within last 7 days and no onboarding flag on user
        const isNew = user?.created_date && (Date.now() - new Date(user.created_date).getTime()) < 7 * 24 * 60 * 60 * 1000;
        if (isNew && !user?.onboarding_complete) {
          setTimeout(() => !cancelled && setOpen(true), 800);
        }
      } catch {
        // not signed in — never show
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const finish = async () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setOpen(false);
    try { await base44.auth.updateMe({ onboarding_complete: true }); } catch {}
  };

  const next = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else finish();
  };

  const current = STEPS[step];
  const Icon = current?.icon;

  return (
    <AnimatePresence>
      {open && current && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={finish}
        >
          <motion.div
            initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
            transition={{ type: 'spring', damping: 22 }}
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-md rounded-3xl bg-card border border-border overflow-hidden shadow-2xl"
          >
            {/* Close */}
            <button onClick={finish} className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center text-white/70 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>

            {/* Hero visual */}
            <div className={`bg-gradient-to-br ${current.gradient} pt-12 pb-8 px-6 text-center relative overflow-hidden`}>
              <motion.div
                key={step}
                initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="text-7xl mb-3"
              >
                {current.visual}
              </motion.div>
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center mx-auto">
                <Icon className="w-6 h-6 text-white" />
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <motion.div key={`text-${step}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <h2 className="text-2xl font-black text-foreground mb-2">{current.title}</h2>
                <p className="text-muted-foreground text-sm leading-relaxed">{current.description}</p>
              </motion.div>

              {/* Step dots */}
              <div className="flex items-center justify-center gap-1.5 py-2">
                {STEPS.map((_, i) => (
                  <button key={i} onClick={() => setStep(i)} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-8 bg-purple-500' : 'w-1.5 bg-border'}`} />
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                {current.cta && (
                  <Link to={current.cta.to} onClick={finish} className="flex-1">
                    <Button variant="outline" className="w-full rounded-xl gap-1.5">
                      {current.cta.label}
                    </Button>
                  </Link>
                )}
                <Button onClick={next} className={`rounded-xl gap-1.5 bg-purple-600 hover:bg-purple-500 ${current.cta ? '' : 'w-full'}`}>
                  {step === STEPS.length - 1 ? (<><Check className="w-4 h-4" /> Get Started</>) : (<>Next <ArrowRight className="w-4 h-4" /></>)}
                </Button>
              </div>

              <button onClick={finish} className="block w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors">
                Skip tour
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}