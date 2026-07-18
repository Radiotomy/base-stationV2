// Canonical COS signal registry used by the Community Tuning Panel.
// Weights mirror src/utils/participationScore.js — the governance board
// proposes changes to these baselines.
export const COS_SIGNALS = [
  { key: 'own_content',      label: 'Bring your own content',   weight: 40 },
  { key: 'detailed_prompt',  label: 'Detailed prompt (100+ chars)', weight: 15 },
  { key: 'reference_upload', label: 'Reference material upload', weight: 15 },
  { key: 'persona_preset',   label: 'Saved persona / template',  weight: 10 },
  { key: 'style_selection',  label: 'Custom genre / mood / style', weight: 10 },
  { key: 'iteration',        label: 'Iteration & refinement',    weight: 10 },
  { key: 'new_signal',       label: '✨ Propose a new signal',   weight: 0 },
];

export const signalLabel = (key) =>
  COS_SIGNALS.find((s) => s.key === key)?.label || key;

export const PROPOSAL_STATUS = {
  open:         { label: 'Open for votes', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  under_review: { label: 'Under review',   cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  adopted:      { label: 'Adopted ✓',      cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  declined:     { label: 'Declined',       cls: 'bg-white/10 text-muted-foreground border-white/10' },
};

export const FLAG_PLATFORMS = [
  { value: 'spotify', label: 'Spotify' },
  { value: 'apple_music', label: 'Apple Music' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'amazon', label: 'Amazon Music' },
  { value: 'tidal', label: 'TIDAL' },
  { value: 'deezer', label: 'Deezer' },
  { value: 'distributor', label: 'Distributor' },
  { value: 'other', label: 'Other' },
];

export const FLAG_STATUS = {
  reported:      { label: 'Reported',      cls: 'bg-white/10 text-white/70 border-white/10' },
  investigating: { label: 'Investigating', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  resolved:      { label: 'Resolved ✓',    cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  escalated:     { label: 'Escalated',     cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
};