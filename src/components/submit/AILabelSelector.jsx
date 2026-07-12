import { Link } from 'react-router-dom';
import AILabelBadge from '@/components/common/AILabelBadge';

/**
 * AILabelSelector — RIAA GenAI self-declaration for track submissions.
 * Artist attests how generative AI was used in the sound recording.
 */
const OPTIONS = [
  {
    value: 'ai_generated',
    title: 'AI-Generated',
    desc: 'Generative AI created all or the primary portion of the recording',
  },
  {
    value: 'ai_assisted',
    title: 'AI-Assisted',
    desc: 'Substantially human recording with some AI-generated elements',
  },
  {
    value: 'human',
    title: 'Human',
    desc: 'No generative AI used in the sound recording',
  },
];

export default function AILabelSelector({ value, onChange }) {
  return (
    <div className="space-y-2">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
            value === opt.value
              ? 'border-emerald-500 bg-emerald-500/10'
              : 'border-border hover:border-emerald-500/40'
          }`}
        >
          {opt.value === 'human' ? (
            <span className="w-6 h-6 rounded-md border-2 border-dashed border-muted-foreground/40 flex-shrink-0" />
          ) : (
            <AILabelBadge label={opt.value} size="sm" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">{opt.title}</p>
            <p className="text-xs text-muted-foreground leading-tight">{opt.desc}</p>
          </div>
        </button>
      ))}
      <p className="text-xs text-muted-foreground/70 pt-1">
        Per the RIAA/IFPI industry standard, this label covers the sound recording only — lyrics and cover art are not included.{' '}
        <Link to="/transparency" className="text-[#FFC98A] underline underline-offset-2">Learn more about these labels</Link>.
        By submitting, you confirm your declaration is accurate per our{' '}
        <Link to="/terms" className="text-[#FFC98A] underline underline-offset-2">Terms of Use</Link>.
      </p>
    </div>
  );
}