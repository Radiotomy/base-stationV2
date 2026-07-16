import { getTier } from '@/utils/participationScore';

/**
 * Creative Ownership Score ring — shows the 0–100 human participation score
 * with the tier color. Pass an item with human_participation_score or score directly.
 */
export default function ParticipationBadge({ item, score: scoreProp, size = 36 }) {
  const score = scoreProp ?? item?.human_participation_score;
  if (score == null) return null;
  const tier = getTier(score);
  const r = (size / 2) - 3;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  return (
    <span title={`${tier.emoji} ${tier.label} — ${score}/100 human participation. ${tier.desc}`}
      className="inline-flex items-center justify-center relative flex-shrink-0"
      style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tier.color} strokeWidth="3"
          strokeDasharray={`${filled} ${circ - filled}`} strokeLinecap="round" />
      </svg>
      <span className="absolute font-black" style={{ color: tier.color, fontSize: size * 0.32 }}>{score}</span>
    </span>
  );
}