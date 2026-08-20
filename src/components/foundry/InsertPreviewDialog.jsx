import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Music, Play, Pause } from 'lucide-react';

// "Load in Studio" — NON-DESTRUCTIVE by construction.
//
// It auditions one of the creator's own tracks THROUGH the Foundry graph, in the
// Foundry's own AudioContext, and writes nothing: no new asset, no mastering-chain
// call, no re-render of the source. The original file is never touched, which is
// why this preview can exist without going anywhere near the marking pipeline.
export default function InsertPreviewDialog({ open, onOpenChange, engine, hasInputNode }) {
  const [tracks, setTracks] = useState(null);
  const [active, setActive] = useState(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!open || tracks) return;
    (async () => {
      const me = await base44.auth.me();
      const rows = await base44.entities.UserAsset.filter(
        { user_id: me.id, asset_type: 'track' },
        '-created_date',
        30,
      );
      setTracks(rows.filter((r) => r.file_url));
    })();
  }, [open, tracks]);

  const audition = async (track) => {
    const el = audioRef.current;
    if (!el) return;
    await engine.ensureContext();
    if (active?.id !== track.id) {
      el.crossOrigin = 'anonymous';
      el.src = track.file_url;
      setActive(track);
    }
    engine.connectElement(el);
    await el.play();
    setPlaying(true);
  };

  const stop = () => {
    audioRef.current?.pause();
    setPlaying(false);
  };

  useEffect(() => { if (!open) stop(); }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md merc-card border-white/10">
        <DialogHeader>
          <DialogTitle className="text-sm">Audition as insert effect</DialogTitle>
        </DialogHeader>

        {!hasInputNode && (
          <p className="text-[11px] text-[#FFC98A] leading-snug">
            This patch has no Insert Input module, so incoming audio has nowhere to enter the
            chain. Add one on the canvas to use it as an insert effect.
          </p>
        )}

        <p className="text-[11px] text-white/45 leading-snug">
          Plays your track through this plugin for listening only. Nothing is saved, re-rendered
          or written back to the original file.
        </p>

        <div className="max-h-64 overflow-y-auto space-y-1.5">
          {tracks === null && (
            <div className="flex items-center gap-2 text-xs text-white/40 py-4">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading your tracks…
            </div>
          )}
          {tracks?.length === 0 && (
            <p className="text-xs text-white/40 py-4">No saved tracks to audition yet.</p>
          )}
          {tracks?.map((t) => {
            const isActive = active?.id === t.id;
            return (
              <button
                key={t.id}
                onClick={() => (isActive && playing ? stop() : audition(t))}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/4 hover:bg-white/8 border border-white/8 text-left"
              >
                {isActive && playing
                  ? <Pause className="w-3 h-3 text-[#FF9A4D] shrink-0" />
                  : <Play className="w-3 h-3 text-white/40 shrink-0" />}
                <Music className="w-3 h-3 text-white/25 shrink-0" />
                <span className="text-[11px] text-white/75 truncate">{t.title}</span>
              </button>
            );
          })}
        </div>

        <audio ref={audioRef} loop className="hidden" />

        <Button variant="outline" onClick={() => onOpenChange(false)} className="h-8 text-xs border-white/12">
          Done
        </Button>
      </DialogContent>
    </Dialog>
  );
}