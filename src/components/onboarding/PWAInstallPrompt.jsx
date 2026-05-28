import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DISMISS_KEY = 'bs_pwa_dismissed_v1';
const DISMISS_DAYS = 7;

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Already installed?
    if (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone) return;

    // Recently dismissed?
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const age = (Date.now() - parseInt(dismissed, 10)) / (1000 * 60 * 60 * 24);
      if (age < DISMISS_DAYS) return;
    }

    // iOS Safari path (no beforeinstallprompt event)
    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua) && !/(crios|fxios|edgios)/.test(ua);
    if (ios) {
      setIsIOS(true);
      setTimeout(() => setVisible(true), 10000);
      return;
    }

    // Android / desktop Chrome path
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setVisible(true), 8000);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setVisible(false);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
    } else {
      dismiss();
    }
    setVisible(false);
    setDeferredPrompt(null);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 24 }}
          className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-[90]"
        >
          <div className="rounded-2xl bg-card border border-purple-500/30 shadow-2xl shadow-purple-500/10 p-4 backdrop-blur-xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center flex-shrink-0">
                <Smartphone className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-foreground">Install BASE Station</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {isIOS
                    ? 'Tap Share → "Add to Home Screen" for a faster, fullscreen experience.'
                    : 'Add to your home screen for offline access & faster load.'}
                </p>
              </div>
              <button onClick={dismiss} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
            {!isIOS && deferredPrompt && (
              <Button onClick={install} className="w-full mt-3 rounded-xl bg-purple-600 hover:bg-purple-500 gap-1.5 h-9 text-xs font-bold">
                <Download className="w-3.5 h-3.5" /> Install App
              </Button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}