import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import InfoTip from '@/components/common/InfoTip';
import {
  NOVA_ASPECTS, NOVA_CANVASES, NOVA_MAX_DURATION, NOVA_MIN_DURATION,
  NOVA_PRESETS, snapFrames, snappedSeconds,
} from '@/config/novaH3Spec';

/**
 * Nova's schedule / format / length controls. Every value here is dictated by
 * MiniMax-H3 itself — the canvas labels are the engine's own table, and the
 * length readout shows the SNAPPED duration because the video VAE only decodes
 * 17n + 5 frames and will never deliver the number a creator typed.
 */
export default function NovaH3Controls({
  preset, setPreset,
  aspect, setAspect,
  canvas, setCanvas,
  duration, setDuration,
  seed, setSeed,
  enhance, setEnhance,
}) {
  const canvasesForAspect = NOVA_CANVASES.filter((c) => c.aspect === aspect);
  const activePreset = NOVA_PRESETS.find((p) => p.id === preset) || NOVA_PRESETS[0];

  const pickAspect = (a) => {
    setAspect(a);
    const first = NOVA_CANVASES.find((c) => c.aspect === a);
    if (first) setCanvas(first.label);
  };

  return (
    <div className="space-y-5">
      {/* Speed / quality schedule */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
          Speed
          <InfoTip text="How many denoising steps run and how aggressively work is reused between them. Balanced is the recommended full-quality path; Turbo presets cut the schedule outright for drafting." />
        </p>
        <div className="space-y-1.5">
          {NOVA_PRESETS.map((p) => (
            <button key={p.id} type="button" onClick={() => setPreset(p.id)}
              className={`w-full text-left p-2.5 rounded-xl border transition-all ${preset === p.id ? 'border-indigo-500 bg-indigo-500/10' : 'border-border bg-card hover:border-indigo-500/40'}`}>
              <p className="text-xs font-bold text-foreground flex items-center gap-2">
                {p.name}
                <span className="text-[10px] font-normal text-muted-foreground">{p.steps} steps</span>
              </p>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">{activePreset.blurb}</p>
      </div>

      {/* Aspect ratio → canvas */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
          Format
          <InfoTip text="H3 renders at a fixed set of canvases. 'fast' costs less GPU time; 'full' is the largest for that ratio. An uploaded keyframe is cover-cropped to the ratio you choose." />
        </p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {NOVA_ASPECTS.map((a) => (
            <button key={a} type="button" onClick={() => pickAspect(a)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${aspect === a ? 'bg-indigo-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
              {a}
            </button>
          ))}
        </div>
        <div className="space-y-1.5">
          {canvasesForAspect.map((c) => (
            <button key={c.label} type="button" onClick={() => setCanvas(c.label)}
              className={`w-full text-left px-3 py-2 rounded-lg border text-xs font-medium transition-all ${canvas === c.label ? 'border-indigo-500 bg-indigo-500/10 text-foreground' : 'border-border bg-card text-muted-foreground hover:border-indigo-500/40'}`}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Length — snapped */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
          Length
          <InfoTip text="Lengths snap upward: the video decoder only produces 17n + 5 frames at 24 fps, so the delivered clip is the value shown below, not the slider position." />
        </p>
        <input type="range" min={NOVA_MIN_DURATION} max={NOVA_MAX_DURATION} step={1}
          value={duration} onChange={(e) => setDuration(Number(e.target.value))}
          className="w-full accent-indigo-500" />
        <p className="text-xs text-muted-foreground mt-1">
          Delivers <span className="font-bold text-foreground">{snappedSeconds(duration).toFixed(3)}s</span>
          {' '}· {snapFrames(duration)} frames at 24 fps, with native stereo audio
        </p>
      </div>

      {/* Seed */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
          Seed
          <InfoTip text="Same prompt + same seed + same preset reproduces the same shot. Leave it blank for a new random one each render." />
        </p>
        <Input value={seed} onChange={(e) => setSeed(e.target.value.replace(/[^\d]/g, ''))}
          placeholder="Random" className="rounded-xl" />
      </div>

      {/* Prompt enhancement */}
      <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-card border border-border">
        <div>
          <p className="text-xs font-bold text-foreground">Enhance prompt</p>
          <p className="text-[11px] text-muted-foreground">
            Rewrites your brief into H3's structured context form. Adds a queue hop and about 20 seconds.
          </p>
        </div>
        <Switch checked={enhance} onCheckedChange={setEnhance} />
      </div>
    </div>
  );
}