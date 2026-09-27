import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Download, Maximize, ArrowLeft, Loader2 } from 'lucide-react';
import DeckSlide from './DeckSlide';
import { DECK_SLIDES } from '@/lib/hackathon/deckSlides';
import { exportDeckPdf } from '@/lib/hackathon/exportDeckPdf';

const W = 1439, H = 810;

export default function SlideDeck() {
  const [i, setI] = useState(0);
  const [scale, setScale] = useState(1);
  const [exporting, setExporting] = useState(false);
  const last = DECK_SLIDES.length - 1;
  const go = (n) => setI(Math.max(0, Math.min(last, n)));

  useEffect(() => {
    const fit = () => setScale(Math.min((window.innerWidth - 32) / W, (window.innerHeight - 110) / H, 1));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') go(i + 1);
      if (e.key === 'ArrowLeft') go(i - 1);
      if (e.key === 'Home') go(0);
      if (e.key === 'End') go(last);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onExport = async () => {
    setExporting(true);
    await exportDeckPdf().finally(() => setExporting(false));
  };

  const btn = 'inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-[#f8f3ed] transition hover:bg-white/10 disabled:opacity-40';

  return (
    <div className="hk-deck fixed inset-0 flex flex-col">
      <div className="relative z-10 flex items-center justify-between px-6 py-3">
        <Link to="/hackathon" className={btn}><ArrowLeft className="h-4 w-4" /> Kit</Link>
        <div className="flex gap-2">
          <button className={btn} onClick={() => document.documentElement.requestFullscreen?.()}><Maximize className="h-4 w-4" /> Present</button>
          <button className={btn} onClick={onExport} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export PDF
          </button>
        </div>
      </div>
      <div className="relative z-10 flex flex-1 items-center justify-center overflow-hidden">
        <div style={{ width: W * scale, height: H * scale }}>
          <div key={i} className="hk-slides" style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
            <DeckSlide slide={DECK_SLIDES[i]} />
          </div>
        </div>
      </div>
      <div className="relative z-10 flex items-center gap-4 px-6 py-3">
        <button className={btn} onClick={() => go(i - 1)} disabled={i === 0}><ChevronLeft className="h-4 w-4" /></button>
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-[#e0b39f] transition-all duration-500" style={{ width: `${((i + 1) / DECK_SLIDES.length) * 100}%` }} />
        </div>
        <span className="text-sm tabular-nums text-[#f8f3ed]/70">{i + 1} / {DECK_SLIDES.length}</span>
        <button className={btn} onClick={() => go(i + 1)} disabled={i === last}><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}