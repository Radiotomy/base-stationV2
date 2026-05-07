import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Radio, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Phase 5.7 — Shown over LiveWatch when session.status flips to 'completed'
 * or a 'session-end' event arrives. Provides a CTA to the recap.
 */
export default function SessionEndedOverlay({ sessionId }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-background/90 backdrop-blur-md flex items-center justify-center px-6"
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        className="max-w-sm w-full bg-card rounded-2xl border border-border p-6 text-center space-y-4"
      >
        <div className="w-14 h-14 mx-auto rounded-full bg-gradient-to-br from-red-700 to-purple-800 flex items-center justify-center">
          <Radio className="w-6 h-6 text-white/80" />
        </div>
        <div>
          <h2 className="text-xl font-black text-foreground">Stream Ended</h2>
          <p className="text-sm text-muted-foreground mt-1">Thanks for tuning in.</p>
        </div>
        {sessionId && (
          <Link to={`/live-summary?sessionId=${sessionId}`}>
            <Button className="w-full rounded-xl bg-purple-600 hover:bg-purple-500 gap-2 font-bold">
              See Recap <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        )}
        <Link to="/" className="block text-xs text-muted-foreground hover:text-foreground">
          ← Back to home
        </Link>
      </motion.div>
    </motion.div>
  );
}