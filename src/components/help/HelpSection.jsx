import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Collapsible help section used on the /help page.
 */
export default function HelpSection({ id, title, icon: Icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  // Deep links (/help#foundry) land on the section, not the top of the page.
  useEffect(() => {
    if (id && window.location.hash === `#${id}`) {
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    }
  }, [id]);
  return (
    <div id={id} className="bg-card border border-border rounded-2xl overflow-hidden scroll-mt-20">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/5 transition-colors text-left"
      >
        {Icon && <Icon className="w-5 h-5 text-purple-400 flex-shrink-0" />}
        <h3 className="font-black text-foreground flex-1">{title}</h3>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-1 text-sm text-muted-foreground leading-relaxed space-y-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}