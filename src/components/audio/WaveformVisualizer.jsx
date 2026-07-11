import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Volume2, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function WaveformVisualizer({ audioUrl, onSegmentSelect, disabled = false }) {
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const peaksRef = useRef(null);
  const animationIdRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedStart, setSelectedStart] = useState(null);
  const [selectedEnd, setSelectedEnd] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState(null);

  // Load audio element + decode static waveform peaks
  useEffect(() => {
    if (!audioUrl) return;
    setIsLoading(true);
    peaksRef.current = null;

    const audio = new Audio(audioUrl);
    audio.preload = 'auto';
    audioRef.current = audio;

    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration);
    });

    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime);
    });

    audio.addEventListener('play', () => setIsPlaying(true));
    audio.addEventListener('pause', () => setIsPlaying(false));
    audio.addEventListener('ended', () => setIsPlaying(false));

    // Decode the file once and compute peak buckets for a static waveform
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(audioUrl);
        const arrayBuf = await resp.arrayBuffer();
        const decodeCtx = new (window.AudioContext || window.webkitAudioContext)();
        const buffer = await decodeCtx.decodeAudioData(arrayBuf);
        decodeCtx.close();
        if (cancelled) return;

        const data = buffer.getChannelData(0);
        const buckets = 256;
        const step = Math.floor(data.length / buckets) || 1;
        const peaks = new Float32Array(buckets);
        for (let i = 0; i < buckets; i++) {
          let max = 0;
          const start = i * step;
          for (let j = start; j < start + step && j < data.length; j += 16) {
            const v = Math.abs(data[j]);
            if (v > max) max = v;
          }
          peaks[i] = max;
        }
        peaksRef.current = peaks;
        if (!duration) setDuration(buffer.duration);
      } catch {
        // Decode failed (unsupported codec / CORS) — playback still works, waveform stays flat
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      audio.pause();
      audio.src = '';
    };
  }, [audioUrl]);

  // Draw waveform
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = '#1e1e2e';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 10; i++) {
      const x = (width / 10) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Draw static waveform (mirrored peaks around center line)
    const peaks = peaksRef.current;
    if (peaks) {
      const barWidth = width / peaks.length;
      const center = height / 2;
      ctx.fillStyle = '#8b5cf6';
      for (let i = 0; i < peaks.length; i++) {
        const barHeight = Math.max(peaks[i] * height * 0.9, 1.5);
        ctx.fillRect(i * barWidth, center - barHeight / 2, Math.max(barWidth - 1, 1), barHeight);
      }
      // Highlight the already-played portion
      if (duration > 0) {
        const playedBars = Math.floor((currentTime / duration) * peaks.length);
        ctx.fillStyle = '#06b6d4';
        for (let i = 0; i < playedBars; i++) {
          const barHeight = Math.max(peaks[i] * height * 0.9, 1.5);
          ctx.fillRect(i * barWidth, center - barHeight / 2, Math.max(barWidth - 1, 1), barHeight);
        }
      }
    }

    // Draw playback line
    const playbackX = (currentTime / duration) * width;
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playbackX, 0);
    ctx.lineTo(playbackX, height);
    ctx.stroke();

    // Draw selection range
    if (selectedStart !== null && selectedEnd !== null) {
      const startX = (selectedStart / duration) * width;
      const endX = (selectedEnd / duration) * width;
      ctx.fillStyle = '#06b6d430';
      ctx.fillRect(startX, 0, endX - startX, height);

      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(startX, 0, endX - startX, height);
      ctx.setLineDash([]);
    }
  }, [currentTime, duration, selectedStart, selectedEnd]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      drawWaveform();
      animationIdRef.current = requestAnimationFrame(animate);
    };

    animationIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, [drawWaveform]);

  // Handle canvas click for segment selection
  const handleCanvasClick = (e) => {
    if (!audioRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickTime = (x / canvas.width) * duration;

    if (selectedStart === null) {
      setSelectedStart(clickTime);
      setSelectedEnd(null);
    } else if (selectedEnd === null) {
      if (clickTime > selectedStart) {
        setSelectedEnd(clickTime);
      } else {
        setSelectedStart(clickTime);
        setSelectedEnd(selectedStart);
      }
    } else {
      setSelectedStart(clickTime);
      setSelectedEnd(null);
    }
  };

  const handleCanvasMouseDown = (e) => {
    if (!audioRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / canvas.width) * duration;

    if (selectedStart !== null && selectedEnd !== null) {
      const margin = duration * 0.05;
      if (Math.abs(time - selectedStart) < margin) {
        setDragMode('start');
        setIsDragging(true);
      } else if (Math.abs(time - selectedEnd) < margin) {
        setDragMode('end');
        setIsDragging(true);
      } else if (time > selectedStart && time < selectedEnd) {
        setDragMode('move');
        setIsDragging(true);
      }
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = Math.max(0, Math.min(duration, (x / canvas.width) * duration));

    if (dragMode === 'start') {
      setSelectedStart(Math.min(time, selectedEnd));
    } else if (dragMode === 'end') {
      setSelectedEnd(Math.max(time, selectedStart));
    } else if (dragMode === 'move') {
      const offset = time - selectedStart;
      const length = selectedEnd - selectedStart;
      if (offset >= 0 && offset + length <= duration) {
        setSelectedStart(offset);
        setSelectedEnd(offset + length);
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragMode(null);
  };

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragMode, selectedStart, selectedEnd, duration]);

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const clearSelection = () => {
    setSelectedStart(null);
    setSelectedEnd(null);
  };

  const formatTime = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Waveform Canvas */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Waveform Editor</p>
          {selectedStart !== null && selectedEnd !== null && (
            <button
              onClick={clearSelection}
              className="text-xs px-2 py-1 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
            >
              Clear Selection
            </button>
          )}
        </div>

        <div
          className={`relative rounded-xl overflow-hidden bg-black border border-border ${!audioUrl ? 'opacity-50' : ''}`}
          onMouseDown={handleCanvasMouseDown}
          style={{ cursor: isDragging ? 'grabbing' : 'crosshair' }}
        >
          <canvas
            ref={canvasRef}
            width={800}
            height={120}
            onClick={handleCanvasClick}
            className="w-full"
          />
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Loader className="w-6 h-6 text-purple-400 animate-spin" />
            </div>
          )}
        </div>

        {/* Playback & Selection Info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div>
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
          {selectedStart !== null && selectedEnd !== null && (
            <div className="text-cyan-400 font-semibold">
              Selection: {formatTime(selectedStart)} - {formatTime(selectedEnd)} ({formatTime(selectedEnd - selectedStart)})
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="default"
            onClick={togglePlayback}
            disabled={!audioUrl}
            className="rounded-lg gap-1.5"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isPlaying ? 'Pause' : 'Play'}
          </Button>

          {selectedStart !== null && selectedEnd !== null && (
            <Button
              size="sm"
              onClick={() => {
                if (onSegmentSelect) {
                  onSegmentSelect({
                    startTime: selectedStart,
                    endTime: selectedEnd,
                    duration: selectedEnd - selectedStart,
                  });
                }
              }}
              disabled={disabled}
              className="rounded-lg bg-cyan-600 hover:bg-cyan-500 gap-1.5 text-xs font-bold"
            >
              Use Selection
            </Button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <Volume2 className="w-4 h-4 text-muted-foreground" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              defaultValue="0.7"
              onChange={(e) => {
                if (audioRef.current) {
                  audioRef.current.volume = parseFloat(e.target.value);
                }
              }}
              className="w-20 h-1 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="text-xs text-muted-foreground space-y-1 p-3 rounded-lg bg-muted/30 border border-border">
        <p className="font-semibold">📍 How to select:</p>
        <p>• Click to set start point, click again to set end point</p>
        <p>• Drag selection edges or the middle to adjust</p>
        <p>• Click "Use Selection" to apply effects to the segment</p>
      </div>
    </motion.div>
  );
}