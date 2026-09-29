import MercuryDisplayHeader from './MercuryDisplayHeader';

/** A mounted rack unit: brushed chassis, rack-ear screws, display header, then controls. */
export default function RackUnit({ icon, title, status, live, extra, description, children, className = '' }) {
  return (
    <section className={`rack-unit space-y-4 ${className}`}>
      <MercuryDisplayHeader icon={icon} title={title} status={status} live={live} extra={extra} />
      {description && <p className="text-sm text-muted-foreground px-1">{description}</p>}
      {children}
    </section>
  );
}