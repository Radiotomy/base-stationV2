import { useState, useRef, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';

/**
 * Tiny inline tooltip used across all studios to explain controls without
 * cluttering the UI. Click or hover to toggle on mobile/desktop.
 *
 * Props:
 *   - text: string or ReactNode shown inside the tooltip
 *   - side: 'top' (default) | 'bottom' — which side of the trigger the bubble opens
 *   - size: 'xs' | 'sm' (default 'xs')
 *   - className: optional extra classes on the trigger button
 *   - icon: optional override for the trigger node (defaults to HelpCircle)
 */
export default function InfoTip({ text, side = 'top', size = 'xs', className = '', icon }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const iconClass = size === 'sm' ? 'w-3.5 h-3.5' : 'w-3 h-3';
  const bubblePos = side === 'bottom'
    ? 'top-full mt-2'
    : 'bottom-full mb-2';

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((p) => !p); }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className={`text-muted-foreground hover:text-foreground transition-colors inline-flex items-center ${className}`}
        aria-label="More info"
      >
        {icon || <HelpCircle className={iconClass} />}
      </button>
      {open && (
        <span
          role="tooltip"
          className={`absolute z-50 left-1/2 -translate-x-1/2 ${bubblePos} w-60 max-w-[16rem] p-2.5 rounded-lg bg-black/95 border border-white/15 text-[11px] leading-relaxed text-white shadow-2xl pointer-events-none`}
        >
          {text}
        </span>
      )}
    </span>
  );
}