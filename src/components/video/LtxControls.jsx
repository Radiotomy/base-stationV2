import { Badge } from '@/components/ui/badge';
import InfoTip from '@/components/common/InfoTip';

export const LTX_MODELS = [
  { value: 'ltx-2-5-fast', label: 'Fast', desc: 'Up to 4K · clips to 20s' },
  { value: 'ltx-2-5-pro',  label: 'Pro',  desc: 'Highest fidelity · 1080p · to 10s' },
];
export const ASPECT_RATIOS = [
  { value: '16:9', label: '16:9', desc: 'Landscape / YouTube' },
  { value: '9:16', label: '9:16', desc: 'Portrait / Reels' },
];
export const RESOLUTION_TIERS = ['720p', '1080p', '1440p', '4k'];
export const DURATIONS_FAST = [6, 8, 10, 12, 14, 16, 18, 20];
export const DURATIONS_PRO = [6, 8, 10];
export const CAMERA_MOTIONS = [
  { value: '', label: 'None' },
  { value: 'static', label: 'Static' },
  { value: 'dolly_in', label: 'Dolly In' },
  { value: 'dolly_out', label: 'Dolly Out' },
  { value: 'dolly_left', label: 'Dolly Left' },
  { value: 'dolly_right', label: 'Dolly Right' },
  { value: 'jib_up', label: 'Jib Up' },
  { value: 'jib_down', label: 'Jib Down' },
  { value: 'focus_shift', label: 'Focus Shift' },
];

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
 * LTX-2.5 generation controls — model, aspect ratio, resolution, duration,
 * frame rate, camera motion and native audio.
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
  const isPro = model === 'ltx-2-5-pro';
  const durations = isPro ? DURATIONS_PRO : DURATIONS_FAST;
  const tiers = isPro ? ['720p', '1080p'] : RESOLUTION_TIERS;
  const highRes = resolutionTier === '1440p' || resolutionTier === '4k';
  const audioMode = mode === 'audio';

  return (
    <div className="space-y-5">
      <Section title="Model" tip="Fast is cheaper and reaches 4K / 20s. Pro gives the highest fidelity but caps at 1080p and 10s.">
        <div className="grid grid-cols-2 gap-2">
          {LTX_MODELS.map(m => (
            <button key={m.value} type="button" onClick={() => setModel(m.value)}
              className={`p-2.5 rounded-xl border text-left transition-all ${model === m.value ? 'border-indigo-500 bg-indigo-500/10' : 'border-border bg-card hover:border-indigo-500/40'}`}>
              <p className="text-sm font-bold text-foreground">{m.label}</p>
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

      {!audioMode && (
        <Section title="Resolution" tip="1440p and 4K are Fast-only and cap clips at 10 seconds.">
          <div className="flex flex-wrap gap-1.5">
            {tiers.map(t => (
              <Chip key={t} active={resolutionTier === t} onClick={() => setResolutionTier(t)}>
                {t.toUpperCase()}
              </Chip>
            ))}
          </div>
        </Section>
      )}

      {!audioMode && (
        <Section title={<>Duration: <span className="text-foreground">{duration === null ? 'Auto' : `${duration}s`}</span></>}
          tip="Auto lets LTX pick the length from your prompt. Longer clips cost more credits.">
          <div className="flex flex-wrap gap-1.5">
            <Chip active={duration === null} onClick={() => setDuration(null)}>Auto</Chip>
            {durations.filter(d => !(highRes || fps === 48) || d <= 10).map(d => (
              <Chip key={d} active={duration === d} onClick={() => setDuration(d)}>{d}s</Chip>
            ))}
          </div>
        </Section>
      )}

      {!audioMode && !isPro && (
        <Section title="Frame Rate" tip="48 fps is Fast-only and limited to clips of 10 seconds or less.">
          <div className="flex flex-wrap gap-1.5">
            {[24, 48].map(f => (
              <Chip key={f} active={fps === f} onClick={() => setFps(f)}>{f} fps</Chip>
            ))}
          </div>
        </Section>
      )}

      {!audioMode && (
        <Section title="Camera Motion" tip="Optional camera move applied across the whole clip.">
          <div className="flex flex-wrap gap-1.5">
            {CAMERA_MOTIONS.map(c => (
              <Chip key={c.value || 'none'} active={cameraMotion === c.value} onClick={() => setCameraMotion(c.value)}>
                {c.label}
              </Chip>
            ))}
          </div>
        </Section>
      )}

      {!audioMode && (
        <Section title="Soundtrack" tip="LTX-2.5 can generate matching audio for the scene. Turn off for silent video.">
          <button type="button" onClick={() => setGenerateAudio(!generateAudio)}
            className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-all ${generateAudio ? 'border-indigo-500 bg-indigo-500/10' : 'border-border bg-card'}`}>
            <span className="text-sm font-bold text-foreground">Generate audio</span>
            <Badge variant="outline" className="text-xs">{generateAudio ? 'On' : 'Off — silent'}</Badge>
          </button>
        </Section>
      )}

      {audioMode && (
        <p className="text-xs text-muted-foreground">
          Audio-to-video renders at 1080p / 24 fps and takes its length from your uploaded track (2–{isPro ? 10 : 20}s).
        </p>
      )}
    </div>
  );
}