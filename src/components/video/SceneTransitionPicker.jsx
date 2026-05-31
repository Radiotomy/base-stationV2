import { ArrowRight } from 'lucide-react';

/**
 * Compact inline picker for the transition that plays AFTER this scene
 * (i.e. the way scene N flows into scene N+1).
 *
 * Renders nothing when this is the last scene.
 */
const OPTIONS = [
  { v: 'none', label: 'Cut' },
  { v: 'crossfade', label: 'Crossfade' },
  { v: 'slide-left', label: 'Slide ←' },
  { v: 'slide-right', label: 'Slide →' },
  { v: 'slide-up', label: 'Slide ↑' },
  { v: 'wipe-left', label: 'Wipe ←' },
  { v: 'wipe-right', label: 'Wipe →' },
];

export default function SceneTransitionPicker({ value, onChange, isLast }) {
  if (isLast) return null;
  const current = value && value !== 'none' ? value : 'none';
  return (
    <div className="flex items-center gap-1.5 pl-8 -mt-1">
      <ArrowRight className="w-3 h-3 text-muted-foreground" />
      <select
        value={current}
        onChange={(e) => onChange(e.target.value === 'none' ? null : e.target.value)}
        className="text-[10px] bg-muted/40 border border-border rounded-md px-1.5 py-0.5 text-muted-foreground hover:text-foreground"
      >
        {OPTIONS.map((o) => (
          <option key={o.v} value={o.v}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}