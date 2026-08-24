import { useRef, useState } from 'react';
import { Scissors, MousePointer2, ZoomIn, ZoomOut } from 'lucide-react';
import InfoTip from '@/components/common/InfoTip';
import TimelineClip from './TimelineClip';
import AutomationLane from './AutomationLane';
import { SNAP_OPTIONS, quantize, uid } from '@/lib/substation/session';

const LANE_H = 56;

export default function TimelineStage({
  session, patch, selectedTrackId, onSelectTrack,
  selectedClipId, onSelectClip, onPatchClip, onAddClip, position, onSeek,
}) {
  const [sliceMode, setSliceMode] = useState(false);
  const scrollRef = useRef(null);
  const drag = useRef(null);
  const pxPerBeat = session.zoom;
  const lastEnd = Math.max(32, ...session.tracks.flatMap(t => t.clips.map(c => c.start + c.length)), session.loop.end);
  const totalBeats = Math.ceil(lastEnd / 4) * 4 + 16;
  const width = totalBeats * pxPerBeat;

  const selectedTrack = session.tracks.find(t => t.id === selectedTrackId) || null;

  const setTracks = (fn) => patch({ tracks: session.tracks.map(fn) });

  const beginDrag = (e, track, clip, mode) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { startX: e.clientX, trackId: track.id, clipId: clip.id, mode, origStart: clip.start, origLen: clip.length };
  };

  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const deltaBeats = (e.clientX - d.startX) / pxPerBeat;
    setTracks((t) => t.id !== d.trackId ? t : {
      ...t,
      clips: t.clips.map((c) => {
        if (c.id !== d.clipId) return c;
        if (d.mode === 'move') return { ...c, start: quantize(d.origStart + deltaBeats, session.snap) };
        return { ...c, length: Math.max(0.25, quantize(d.origLen + deltaBeats, session.snap) || 0.25) };
      }),
    });
  };

  const endDrag = () => { drag.current = null; };

  const laneClick = (e, track) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const beat = quantize((e.clientX - rect.left) / pxPerBeat, session.snap);
    onSelectTrack(track.id);
    if (e.detail === 2) onAddClip(track.id, beat);
  };

  const sliceClip = (e, track, clip) => {
    if (!sliceMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const at = (e.clientX - rect.left) / pxPerBeat;
    const cut = quantize(at, session.snap);
    if (cut <= clip.start + 0.1 || cut >= clip.start + clip.length - 0.1) return;
    setTracks((t) => t.id !== track.id ? t : {
      ...t,
      clips: t.clips.flatMap((c) => c.id !== clip.id ? [c] : [
        { ...c, length: cut - c.start },
        { ...c, id: uid('c'), start: cut, length: c.start + c.length - cut, offset: (c.offset || 0) + (cut - c.start) },
      ]),
    });
  };

  return (
    <div className="rounded-xl border border-white/10 bg-[#09090b] overflow-hidden flex flex-col min-h-0">
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-white/8 flex-wrap">
        <button onClick={() => setSliceMode(false)}
          className={`h-6 px-2 rounded text-[10px] font-mono border flex items-center gap-1 ${!sliceMode ? 'border-[#14b8a6] text-[#14b8a6] bg-[#14b8a6]/10' : 'border-white/12 text-white/45'}`}>
          <MousePointer2 className="w-2.5 h-2.5" /> Edit
        </button>
        <button onClick={() => setSliceMode(true)}
          className={`h-6 px-2 rounded text-[10px] font-mono border flex items-center gap-1 ${sliceMode ? 'border-[#fb7185] text-[#fb7185] bg-[#fb7185]/10' : 'border-white/12 text-white/45'}`}>
          <Scissors className="w-2.5 h-2.5" /> Slice
        </button>
        <div className="w-px h-4 bg-white/10" />
        <span className="text-[9px] font-mono uppercase text-white/35">Snap</span>
        {SNAP_OPTIONS.map(o => (
          <button key={o.id} onClick={() => patch({ snap: o.id })}
            className={`h-6 px-1.5 rounded text-[10px] font-mono border ${session.snap === o.id ? 'border-[#f59e0b] text-[#f59e0b] bg-[#f59e0b]/10' : 'border-white/12 text-white/45'}`}>
            {o.label}
          </button>
        ))}
        <div className="w-px h-4 bg-white/10" />
        <button onClick={() => patch({ zoom: Math.max(14, session.zoom - 6) })} className="text-white/45 hover:text-white"><ZoomOut className="w-3.5 h-3.5" /></button>
        <button onClick={() => patch({ zoom: Math.min(90, session.zoom + 6) })} className="text-white/45 hover:text-white"><ZoomIn className="w-3.5 h-3.5" /></button>
        <InfoTip size="sm" side="bottom" text="Double-click an empty lane to place a clip. Drag to move, drag the right edge to trim, and use Slice to cut a clip at the grid." />
      </div>

      <div ref={scrollRef} className="overflow-auto flex-1" onPointerMove={onMove} onPointerUp={endDrag} onPointerLeave={endDrag}>
        <div style={{ width }}>
          {/* Ruler */}
          <div className="relative h-6 border-b border-white/8 bg-black/40 cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              onSeek((e.clientX - rect.left) / pxPerBeat);
            }}>
            {Array.from({ length: Math.ceil(totalBeats / 4) }).map((_, bar) => (
              <div key={bar} className="absolute top-0 bottom-0 border-l border-white/10"
                style={{ left: bar * 4 * pxPerBeat }}>
                <span className="pl-1 text-[9px] font-mono text-white/30">{bar + 1}</span>
              </div>
            ))}
            {session.loop.enabled && (
              <div className="absolute top-0 bottom-0 bg-[#f59e0b]/15 border-x border-[#f59e0b]/50"
                style={{ left: session.loop.start * pxPerBeat, width: (session.loop.end - session.loop.start) * pxPerBeat }} />
            )}
          </div>

          {/* Lanes */}
          <div className="relative">
            {session.tracks.map((t) => (
              <div key={t.id}
                onPointerDown={(e) => laneClick(e, t)}
                onDoubleClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  onAddClip(t.id, quantize((e.clientX - rect.left) / pxPerBeat, session.snap));
                }}
                className={`relative border-b border-white/6 ${t.id === selectedTrackId ? 'bg-white/[0.03]' : ''}`}
                style={{ height: LANE_H }}
              >
                {Array.from({ length: Math.ceil(totalBeats / 4) }).map((_, bar) => (
                  <div key={bar} className="absolute top-0 bottom-0 border-l border-white/[0.05]" style={{ left: bar * 4 * pxPerBeat }} />
                ))}
                {t.clips.map((c) => (
                  <div key={c.id} onPointerDown={(e) => sliceClip(e, t, c)} className="contents">
                    <TimelineClip
                      clip={c}
                      color={t.color}
                      pxPerBeat={pxPerBeat}
                      selected={c.id === selectedClipId}
                      sliceMode={sliceMode}
                      onSelect={() => { onSelectTrack(t.id); onSelectClip(c.id); }}
                      onDragStart={(e) => beginDrag(e, t, c, 'move')}
                      onResizeStart={(e) => beginDrag(e, t, c, 'resize')}
                    />
                  </div>
                ))}
              </div>
            ))}

            {/* Playhead */}
            <div className="absolute top-0 bottom-0 w-px bg-[#14b8a6] pointer-events-none"
              style={{ left: position * pxPerBeat, boxShadow: '0 0 8px #14b8a6' }} />
          </div>

          <AutomationLane
            track={selectedTrack}
            pxPerBeat={pxPerBeat}
            totalBeats={totalBeats}
            onChange={(pts) => setTracks((t) => t.id === selectedTrackId ? { ...t, automation: pts } : t)}
          />
        </div>
      </div>
    </div>
  );
}