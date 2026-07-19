import MethodBadge from './MethodBadge';

export default function EndpointHeader({ method, path, description }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <MethodBadge method={method} />
        <code className="text-sm font-mono text-foreground break-all">{path}</code>
      </div>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}