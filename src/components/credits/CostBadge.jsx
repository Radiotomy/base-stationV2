import { Coins } from 'lucide-react';

/**
 * Tiny pill badge that shows the credit cost of an action.
 * Used next to "Generate" buttons across all studios.
 *
 * Props:
 * - cost: number (credits required)
 * - size: 'sm' | 'md' (default 'md')
 * - className: optional extra classes
 */
export default function CostBadge({ cost, size = 'md', className = '' }) {
  if (!cost || cost <= 0) return null;
  const sizeClasses = size === 'sm'
    ? 'text-[10px] px-1.5 py-0.5 gap-0.5'
    : 'text-xs px-2 py-0.5 gap-1';
  return (
    <span
      title={`Costs ${cost} credit${cost === 1 ? '' : 's'}`}
      className={`inline-flex items-center rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold ${sizeClasses} ${className}`}
    >
      <Coins className={size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      {cost}
    </span>
  );
}