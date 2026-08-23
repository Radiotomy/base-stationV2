import ModelFamilySelect from '@/components/music/ModelFamilySelect';
import {
  SONIC_FAMILIES,
  TEMPOLOR_SONG_FAMILIES,
  TEMPOLOR_INSTRUMENTAL_FAMILIES,
  TRACKS_PER_GENERATION,
} from '@/config/musicModelCatalog';

// Manual model selection for Quick Generate. Shown when a creator takes over
// from auto-routing — the exact same catalog Advanced Generate offers, so
// nothing is only reachable from the pro tab.
export default function QuickModelPicker({ provider, model, onSelectModel, instrumental }) {
  const families = provider === 'sonic'
    ? SONIC_FAMILIES
    : instrumental ? TEMPOLOR_INSTRUMENTAL_FAMILIES : TEMPOLOR_SONG_FAMILIES;
  const perRun = TRACKS_PER_GENERATION[provider] || 1;

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase">AI Model</p>
      <ModelFamilySelect
        families={families}
        value={model}
        onSelect={onSelectModel}
        accentClass={provider === 'sonic' ? 'border-cyan-500 bg-cyan-500/10' : 'border-amber-500 bg-amber-500/10'}
      />
      <p className="text-[10px] text-muted-foreground">
        {perRun > 1
          ? `Sonic returns ${perRun} tracks per generation — you pick your favourite.`
          : 'This model returns 1 track per generation.'}
      </p>
    </div>
  );
}