import { Link } from 'react-router-dom';

export default function CommunityBlueprint() {
  return (
    <section className="border-t border-slate-800/80 pt-12 mb-16">
      <div className="max-w-3xl">
        <div className="flex items-center space-x-3 text-xs uppercase tracking-widest text-amber-500 mb-3 font-mono">
          <span className="h-2 w-2 rounded-full bg-amber-500" style={{ boxShadow: '0 0 8px #FF9A4D' }} />
          <span>The Community Framework: Adaptive Governance</span>
        </div>
        <h2 className="text-2xl font-semibold text-slate-100 mb-4 tracking-tight">
          A Living Metric Built by the Community, For the Community
        </h2>
        <p className="text-slate-300 mb-6 leading-relaxed">
          Technology moves at breakneck speed, and no single entity should hold the monopoly on
          defining what constitutes 'human creative effort.' That is why the{' '}
          <strong className="text-slate-100">Creative Ownership Score (COS)</strong> is designed as
          an open, adaptive ledger — not a static ceiling. BASE Station doesn't dictate the rules;
          we provide the framework for the community to benchmark, define, and collectively defend
          human creative intent.
        </p>
        <p className="text-slate-300 mb-6 leading-relaxed">
          Just as early digital audio tracking required collaboration between independent
          broadcasters to establish fair measurement, modern generative media requires a collective
          voice. We invite our builders, engineers, and musical artists to actively participate in
          tuning our telemetry logic, evaluating new algorithmic baselines, and proving that
          transparent disclosure is a collaborative triumph, not a top-down constraint.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/governance"
            className="inline-block merc-button font-mono text-xs uppercase font-bold tracking-wider px-5 py-2.5 rounded-md"
          >
            Open the Community Tuning Panel
          </Link>
          <Link
            to="/creative-ownership"
            className="inline-block merc-button-dark font-mono text-xs uppercase font-bold tracking-wider px-5 py-2.5 rounded-md"
          >
            How the COS Works
          </Link>
        </div>
      </div>
    </section>
  );
}