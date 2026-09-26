import { Link } from 'react-router-dom';
import { Headphones } from 'lucide-react';

/** "On Audius" chip for a chart or playlist row that has a confirmed Audius release. */
export default function AudiusCrossLink({ trackId, permalink }) {
  if (!trackId && !permalink) return null;
  const cls = 'inline-flex items-center gap-1 rounded-full border border-border px-1.5 py-0 text-[11px] text-muted-foreground hover:text-foreground';
  const stop = (e) => e.stopPropagation();
  const body = <><Headphones className="w-3 h-3" /> On Audius</>;
  return trackId
    ? <Link to={`/audius-track/${trackId}`} onClick={stop} className={cls}>{body}</Link>
    : <a href={permalink} target="_blank" rel="noreferrer" onClick={stop} className={cls}>{body}</a>;
}