import LiveVisualizer from '@/components/live/LiveVisualizer';
import { useAudioAnalyzer } from '@/hooks/useAudioAnalyzer';

/**
 * Phase 5.7 — Small audio-reactive preview tile shown to the performer
 * inside LiveStudio so they can see what fans see.
 */
export default function LocalVisualizerPreview({ audioRef, style = 'spectrum', isPlaying = false }) {
  const audio = useAudioAnalyzer(audioRef, { enabled: true });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide">Visualizer Preview</p>
        <p className="text-[10px] text-muted-foreground font-mono">
          peak {(audio.peak * 100).toFixed(0)}%
        </p>
      </div>
      <LiveVisualizer
        style={style}
        isPlaying={isPlaying}
        audioData={audio}
      />
    </div>
  );
}