import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

/** Grouped desktop nav dropdown, styled to match the rack-pill header aesthetic. */
export default function NavDropdown({ label, icon: Icon, items, currentPath }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const isActive = items.some((i) => i.to === currentPath);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border transition-all ${
          isActive
            ? "text-[#1F3A0E] border-black shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]"
            : "text-white/60 border-black/60 bg-gradient-to-b from-[#28211A] to-[#171310] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] hover:text-[#FF9A4D] hover:border-[#FF9A4D]/40"
        }`}
        style={isActive ? { background: "linear-gradient(180deg, #C8EF92 0%, #A9DC66 100%)" } : undefined}
      >
        <Icon className="w-4 h-4" />
        {label}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute left-0 mt-2 w-48 rounded-lg overflow-hidden border-2 border-black bg-gradient-to-b from-[#221B14] to-[#0F0C09] shadow-[0_12px_36px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.08)] p-2 space-y-1 z-50"
          >
            {items.map(({ to, label: itemLabel, icon: ItemIcon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                  currentPath === to
                    ? "text-[#FF9A4D] bg-white/5 font-bold"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                }`}
              >
                <ItemIcon className="w-4 h-4" /> {itemLabel}
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}