import InfoTip from '@/components/common/InfoTip';

/**
 * Numbered step wrapper for the Quick Generate form. Exists so the form reads as
 * an ordered flow (describe → fine-tune → engine) instead of a flat stack of
 * equally-weighted label/control pairs, which is what made it hard to scan.
 */
export default function QuickSection({ step, title, hint, tip, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-border bg-card/40 p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="w-6 h-6 rounded-full bg-muted text-foreground text-xs font-black flex items-center justify-center flex-shrink-0">
          {step}
        </span>
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        {tip && <InfoTip text={tip} />}
        {hint && <span className="text-xs text-muted-foreground ml-auto hidden sm:block">{hint}</span>}
      </div>
      {children}
    </section>
  );
}