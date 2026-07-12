/**
 * AILabelBadge — official RIAA/IFPI GenAI disclosure marks (July 2026 standard).
 *
 * ai_generated → solid square, bold uppercase "AI"
 * ai_assisted  → outlined square, lowercase "ai"
 * human / null → renders nothing
 *
 * Monochrome, adapts to theme (foreground on dark = light mark).
 */
const SIZES = {
  xs: { box: 'w-5 h-5 rounded-[5px]', text: 'text-[10px]' },
  sm: { box: 'w-6 h-6 rounded-md', text: 'text-xs' },
  md: { box: 'w-8 h-8 rounded-lg', text: 'text-sm' },
};

const LABELS = {
  ai_generated: 'AI-Generated: generative AI created the entirety or primary portion of this sound recording',
  ai_assisted: 'AI-Assisted: substantially human recording with some generative AI elements',
};

export default function AILabelBadge({ label, size = 'xs', showText = false, className = '' }) {
  if (label !== 'ai_generated' && label !== 'ai_assisted') return null;
  const s = SIZES[size] || SIZES.xs;
  const generated = label === 'ai_generated';

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} title={LABELS[label]}>
      <span
        className={`${s.box} ${s.text} inline-flex items-center justify-center font-black leading-none select-none flex-shrink-0 ${
          generated
            ? 'bg-foreground text-background'
            : 'border-2 border-foreground text-foreground bg-transparent'
        }`}
        style={{ fontFamily: 'Arial, Helvetica, sans-serif', letterSpacing: '-0.05em' }}
        aria-label={generated ? 'AI-Generated' : 'AI-Assisted'}
      >
        {generated ? 'AI' : 'ai'}
      </span>
      {showText && (
        <span className="text-xs font-semibold text-muted-foreground">
          {generated ? 'AI-Generated' : 'AI-Assisted'}
        </span>
      )}
    </span>
  );
}