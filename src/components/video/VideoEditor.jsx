import { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, Scissors, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';

export default function VideoEditor({ videoUrl, onSave, title = 'Video Editor' }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [subtitles, setSubtitles] = useState([]);
  const [newSubtitle, setNewSubtitle] = useState('');

  useEffect(() => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const handleLoadedMetadata = () => setDuration(video.duration);
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      updateThumbnail();
    };
    const handleEnded = () => setIsPlaying(false);

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
    };
  }, [videoUrl]);

  const updateThumbnail = () => {
    if (videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatTime = (seconds) => {
    if (!seconds || !Number.isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const handleTrimStart = () => {
    setTrimStart(currentTime);
    toast.success(`Trim start: ${formatTime(currentTime)}`);
  };

  const handleTrimEnd = () => {
    setTrimEnd(currentTime);
    toast.success(`Trim end: ${formatTime(currentTime)}`);
  };

  const addSubtitle = () => {
    if (!newSubtitle) {
      toast.error('Enter subtitle text');
      return;
    }
    setSubtitles([...subtitles, { time: currentTime, text: newSubtitle }]);
    setNewSubtitle('');
    toast.success('Subtitle added!');
  };

  const saveCuts = () => {
    if (trimStart === 0 && trimEnd === 0) {
      toast.error('Set trim points first');
      return;
    }
    onSave?.({ trimStart, trimEnd, subtitles, duration: trimEnd - trimStart });
    toast.success('Edit points saved!');
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-6 space-y-6">
      <h3 className="font-black text-foreground">{title}</h3>

      {/* Video Preview */}
      <div className="rounded-xl overflow-hidden bg-black">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full"
          crossOrigin="anonymous"
          style={{ aspectRatio: '16/9' }}
        />
      </div>

      {/* Thumbnail Canvas */}
      <canvas ref={canvasRef} width={320} height={180} className="hidden" />

      {/* Timeline */}
      <div className="space-y-2">
        <Slider
          value={[currentTime]}
          onValueChange={(value) => {
            if (videoRef.current) {
              videoRef.current.currentTime = value[0];
              setCurrentTime(value[0]);
            }
          }}
          max={duration}
          step={0.1}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Playback Controls */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Button
          onClick={togglePlayPause}
          className="bg-indigo-600 hover:bg-indigo-500 rounded-xl gap-2"
          size="sm"
        >
          {isPlaying ? (
            <><Pause className="w-4 h-4" /> Pause</>
          ) : (
            <><Play className="w-4 h-4" /> Play</>
          )}
        </Button>

        <Button onClick={() => { if (videoRef.current) videoRef.current.currentTime = 0; setCurrentTime(0); }} variant="outline" size="sm" className="rounded-xl gap-2">
          <RotateCcw className="w-4 h-4" /> Reset
        </Button>

        <Button onClick={handleTrimStart} variant="outline" size="sm" className="rounded-xl gap-2">
          <Scissors className="w-4 h-4" /> In
        </Button>

        <Button onClick={handleTrimEnd} variant="outline" size="sm" className="rounded-xl gap-2">
          <Scissors className="w-4 h-4" /> Out
        </Button>
      </div>

      {/* Subtitle Editor */}
      <div className="bg-muted/20 rounded-xl border border-border p-4 space-y-3">
        <h4 className="text-sm font-bold text-foreground">Add Subtitles</h4>
        <div className="flex gap-2">
          <input
            type="text"
            value={newSubtitle}
            onChange={(e) => setNewSubtitle(e.target.value)}
            placeholder="Subtitle text at current time..."
            className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-xs"
            onKeyPress={(e) => e.key === 'Enter' && addSubtitle()}
          />
          <Button onClick={addSubtitle} size="sm" className="bg-indigo-600 hover:bg-indigo-500 rounded-xl">
            Add
          </Button>
        </div>

        {subtitles.length > 0 && (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {subtitles.map((sub, i) => (
              <div key={i} className="flex justify-between items-center text-xs bg-background p-2 rounded-lg">
                <span className="text-muted-foreground">{formatTime(sub.time)}</span>
                <span className="text-foreground flex-1 ml-3">{sub.text}</span>
                <button
                  onClick={() => setSubtitles(subtitles.filter((_, idx) => idx !== i))}
                  className="text-destructive hover:text-destructive/80"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Trim Info */}
      {(trimStart > 0 || trimEnd > 0) && (
        <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-3">
          <p className="text-xs font-semibold text-indigo-300 mb-2">Edit Preview</p>
          <div className="flex justify-between text-xs text-muted-foreground mb-3">
            <span>Start: {formatTime(trimStart)}</span>
            <span>End: {formatTime(trimEnd)}</span>
            <span>Duration: {formatTime(trimEnd - trimStart)}</span>
          </div>
          <Button onClick={saveCuts} className="w-full bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs">
            Save Edits
          </Button>
        </div>
      )}
    </div>
  );
}