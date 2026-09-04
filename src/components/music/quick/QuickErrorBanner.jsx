import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

/**
 * Persistent failure banner for Quick Generate. Deliberately not a toast: a
 * creator who steps away must still be able to see WHY the run stopped, and a
 * credit failure needs an action they can take rather than a message that fades.
 *
 * error — { type: 'credits' | 'error', message, required, balance } | null
 */
export default function QuickErrorBanner({ error, onDismiss }) {
  const isCredits = error?.type === 'credits';
  return (
    <AnimatePresence>
      {error && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
          className={`p-4 rounded-xl border flex items-start gap-3 ${isCredits ? 'bg-amber-500/10 border-amber-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isCredits ? 'text-amber-400' : 'text-red-400'}`} />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-bold mb-0.5 ${isCredits ? 'text-amber-300' : 'text-red-300'}`}>
              {isCredits ? 'Out of Credits' : 'Generation Failed'}
            </p>
            <p className="text-xs text-muted-foreground">{error.message}</p>
            {isCredits && (error.required != null || error.balance != null) && (
              <p className="text-xs text-muted-foreground mt-1">
                Required: <span className="font-semibold text-foreground">{error.required ?? '?'}</span> · Your balance:{' '}
                <span className="font-semibold text-foreground">{error.balance ?? '?'}</span>
              </p>
            )}
            {isCredits && (
              <p className="text-xs text-amber-200/80 mt-2">
                💡 Buy a one-time credit pack or upgrade to a monthly plan for the best per-track value.
              </p>
            )}
            <div className="flex gap-2 mt-2 flex-wrap">
              {isCredits && (
                <>
                  <Link to="/credits">
                    <Button size="sm" className="rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold">Buy Credits</Button>
                  </Link>
                  <Link to="/credits?tab=subscriptions">
                    <Button size="sm" variant="outline" className="rounded-lg text-xs border-amber-500/50 text-amber-300 hover:bg-amber-500/10">Upgrade Plan</Button>
                  </Link>
                </>
              )}
              <Button size="sm" variant="ghost" onClick={onDismiss} className="rounded-lg text-xs">Dismiss</Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}