import { Badge } from '@/components/ui/badge';
import InfoTip from '@/components/common/InfoTip';
import {
  LTX_MODELS, ASPECT_RATIOS, CAMERA_MOTIONS,
  getModelSpec, durationsFor, maxAudioSeconds,
} from '@/config/ltxModelSpec';

const Chip = ({ active, children, ...props }) => (
  <button type="button" {...props}
    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${active ? 'bg-indigo-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
    {children}
  </button>
);

const Section = ({ title, tip, children }) => (
  <div>
    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
      {title}{tip && <InfoTip text={tip} />}
    </p>
    {children}
  </div>
);

/**
 * LTX generation controls — model (LTX-2.5 / LTX-2.3, Fast & Pro), aspect ratio,
 * resolution, duration, frame rate, camera motion and native audio. Every option
 * shown is one the current LTX API actually accepts for the selected model.
 */
export default function LtxControls({
  model, setModel,
  aspectRatio, setAspectRatio,
  resolutionTier, setResolutionTier,
  duration, setDuration,
  fps, setFps,
  cameraMotion, setCameraMotion,
  generateAudio, setGenerateAudio,
  mode,
}) {
  const spec = getModelSpec(model);
  const audioMode = mode === 'audio';
  const durations = durationsFor(model, resolutionTier, fps);
  // Audio-to-video is not offered by every model (LTX-2.3 Fast has no such endpoint)
  const models = LTX_MODELS.filter(m => m.modes.includes(mode || 'text'));

  return (
    <div className="space-y-5">
      <Section title="Model" tip="LTX-2.5 has the strongest prompt adherence, native multi-shot scenes and automatic duration. LTX-2.3 is cheaper per second and reaches 4K on both variants.">
        <div className="grid grid-cols-2 gap-2">
          {models.map(m => (
            <button key={m.value} type="button" onClick={() => setModel(m.value)}
              className={`p-2.5 rounded-xl border text-left transition-all ${model === m.value ? 'border-indigo-500 bg-indigo-500/10' : 'border-border bg-card hover:border-indigo-500/40'}`}>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-bold text-foreground">{m.label}</p>
                <Badge variant="outline" className="text-[10px] px-1 py-0">{m.family}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{m.desc}</p>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Aspect Ratio" tip="9:16 for TikTok / Reels. 16:9 for YouTube.">
        <div className="grid grid-cols-2 gap-2">
          {ASPECT_RATIOS.map(ar => (
            <button key={ar.value} type="button" onClick={() => setAspectRatio(ar.value)}
              className={`p-2.5 rounded-xl border text-left transition-all ${aspectRatio === ar.value ? 'border-indigo-500 bg-indigo-500/10' : 'border-border bg-card hover:border-indigo-500/40'}`}>
              <p className="text-sm font-bold text-foreground">{ar.label}</p>
              <p className="text-xs text-muted-foreground">{ar.desc}</p>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Resolution" tip="Higher tiers cost more per second, and 1440p / 4K cap a clip at 10 seconds.">
        <div className="flex flex-wrap gap-1.5">
          {spec.tiers.map(t => (
            <Chip key={t} active={resolutionTier === t} onClick={() => setResolutionTier(t)}>
              {t.toUpperCase()}
            </Chip>
          ))}
        </div>
      </Section>

      {!audioMode && (
        <Section title={<>Duration: <span className="text-foreground">{duration === null ? 'Auto' : `${duration}s`}</span></>}
          tip={spec.autoDuration
            ? 'Auto lets LTX pick the length from your prompt — billed for what it produces, but your balance has to cover the maximum up front.'
            : 'Automatic duration is an LTX-2.5 feature — pick a fixed length on LTX-2.3.'}>
          <div className="flex flex-wrap gap-1.5">
            {spec.autoDuration && (
              <Chip active={duration === null} onClick={() => setDuration(null)}>Auto</Chip>
            )}
            {durations.map(d => (
              <Chip key={d} active={duration === d} onClick={() => setDuration(d)}>{d}s</Chip>
            ))}
          </div>
        </Section>
      )}

      <Section title="Frame Rate" tip="48 and 50 fps limit clips to 10 seconds or less.">
        <div className="flex flex-wrap gap-1.5">
          {spec.fps.map(f => (
            <Chip key={f} active={fps === f} onClick={() => setFps(f)}>{f} fps</Chip>
          ))}
        </div>
      </Section>

      <Section title="Camera Motion" tip="Optional camera move applied across the whole clip.">
        <div className="flex flex-wrap gap-1.5">
          {CAMERA_MOTIONS.map(c => (
            <Chip key={c.value || 'none'} active={cameraMotion === c.value} onClick={() => setCameraMotion(c.value)}>
              {c.label}
            </Chip>
          ))}
        </div>
      </Section>

      {!audioMode && (
        <Section title="Soundtrack" tip="LTX generates matching audio — dialogue, music and ambience — alongside the visuals. Turn off for silent video.">
          <button type="button" onClick={() => setGenerateAudio(!generateAudio)}
            className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-all ${generateAudio ? 'border-indigo-500 bg-indigo-500/10' : 'border-border bg-card'}`}>
            <span className="text-sm font-bold text-foreground">Generate audio</span>
            <Badge variant="outline" className="text-xs">{generateAudio ? 'On' : 'Off — silent'}</Badge>
          </button>
        </Section>
      )}

      {audioMode && (
        <p className="text-xs text-muted-foreground">
          Your uploaded track sets the length of the video — up to {maxAudioSeconds(model, resolutionTier)}s
          on {spec.label} at {resolutionTier.toUpperCase()}.
        </p>
      )}
    </div>
  );
}