const STYLES = {
  GET: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  POST: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  PUT: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  DELETE: 'bg-red-500/15 text-red-400 border-red-500/30',
};

export default function MethodBadge({ method }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md border text-[11px] font-bold font-mono tracking-wider ${STYLES[method] || STYLES.GET}`}>
      {method}
    </span>
  );
}