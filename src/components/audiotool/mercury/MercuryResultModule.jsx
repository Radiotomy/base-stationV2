/** Chrome-edged mercury-glass module for side results and meters. */
export default function MercuryResultModule({ title, hint, children }) {
  return (
    <section className="rack-module space-y-3">
      {title && <h3 className="rack-readout text-xs font-semibold">{title}</h3>}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
    </section>
  );
}