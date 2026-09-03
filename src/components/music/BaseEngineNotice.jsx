import { Info } from 'lucide-react';

/**
 * Shared banner for the BASE Engines — CODA, Siren Song and Skye. Each is an
 * in-house model we forked from an open-source base and now develop, tune and
 * run on our own infrastructure. Deliberately says nothing about where it is
 * hosted or which GPU it runs on: that is our operational detail, not the
 * creator's, and naming a host implies a third party owns the pipeline.
 */
const ACCENTS = {
  emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200/90',
  cyan: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-200/90',
  violet: 'bg-violet-500/10 border-violet-500/30 text-violet-200/90',
};
const ICONS = { emerald: 'text-emerald-400', cyan: 'text-cyan-400', violet: 'text-violet-400' };
const NAMES = { emerald: 'text-emerald-300', cyan: 'text-cyan-300', violet: 'text-violet-300' };

export default function BaseEngineNotice({ accent = 'emerald', name, children }) {
  return (
    <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${ACCENTS[accent]}`}>
      <Info className={`w-4 h-4 flex-shrink-0 mt-0.5 ${ICONS[accent]}`} />
      <p className="text-xs">
        <span className={`font-bold ${NAMES[accent]}`}>BASE {name}:</span>{' '}
        <span className="font-semibold">a BASE Station in-house engine</span> — self-hosted on our own
        infrastructure, developed and maintained by our team. {children}
      </p>
    </div>
  );
}