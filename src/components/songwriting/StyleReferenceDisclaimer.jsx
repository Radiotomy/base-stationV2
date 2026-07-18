import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Scale, ChevronDown } from 'lucide-react';

/**
 * User-facing disclosure for Pro Songwriter / 243 Masters style references.
 * Explains what artist/writer references actually do, why it's legal, and the user's responsibilities.
 */
export default function StyleReferenceDisclaimer() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl bg-blue-500/5 border border-blue-500/20 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        <Scale className="w-3.5 h-3.5 text-blue-300 flex-shrink-0" />
        <span className="flex-1 text-[11px] font-bold text-blue-200">
          How artist references work — style, not identity
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-blue-300/60 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2 text-[11px] text-blue-100/70 leading-relaxed">
              <p>
                <strong className="text-blue-200">What it does:</strong> a reference name is converted into
                abstract craft descriptors only — rhyme scheme, tempo range, prosody, narrative tone, and
                genre conventions. No lyrics, recordings, or voice of that artist are copied or simulated.
              </p>
              <p>
                <strong className="text-blue-200">Why it's legal:</strong> copyright protects specific
                expression, not styles, structures, or genres. Studying and applying a writer's craft
                archetype is the same thing songwriting students do every day. The artist's name is never
                placed in your output, metadata, or credits.
              </p>
              <p>
                <strong className="text-blue-200">Your responsibility:</strong> don't market your song as
                being "by" or "in the voice of" a real artist, and carry the AI disclosure label assigned
                to the work through distribution. Your structural choices here are logged as human
                participation in the track's Provenance Manifest.
              </p>
              <p className="pt-1 border-t border-blue-500/15">
                Full details: <Link to="/transparency" className="text-blue-300 hover:underline">AI Transparency</Link>
                {' · '}
                <Link to="/terms" className="text-blue-300 hover:underline">Terms of Use</Link>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}