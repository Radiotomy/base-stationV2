import { motion, AnimatePresence } from "framer-motion";

/**
 * Slim rack accordion bar — collapsed hardware strip that expands
 * to reveal a panel (EQ, All Channels) on the Boombox layout.
 */
export default function AccordionBar({ title, open, onToggle, right = null, children }) {
  return (
    <div className="rounded-lg border border-black/80 bg-gradient-to-b from-[#1C1712] to-[#0F0C09] overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_6px_16px_rgba(0,0,0,0.5)]">
      <button onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 active:bg-white/5">
        <span className="flex items-center gap-2.5">
          <span className={`w-1.5 h-1.5 rounded-full ${open ? "bg-[#C6F27E] shadow-[0_0_6px_#C6F27E]" : "bg-white/20"}`} />
          <span className="text-[11px] font-mono font-bold tracking-[0.25em] uppercase text-[#D9CBB8]">{title}</span>
        </span>
        <span className="flex items-center gap-3">
          {right}
          <span className="text-white/40 text-[10px] font-bold">{open ? "▲" : "▼"}</span>
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            <div className="px-3 pb-3 pt-1 border-t border-white/5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}