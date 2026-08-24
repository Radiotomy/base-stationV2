import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Import, Search, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import InfoTip from '@/components/common/InfoTip';

const AUDIO_TYPES = ['track', 'stem', 'master', 'mashup', 'harmony', 'loop', 'sfx'];

const SOURCE_LABEL = {
  track: 'Music Studio', stem: 'Stem Creator', master: 'Mastering',
  mashup: 'Mashup', harmony: 'Harmonizer', loop: 'Loop Studio', sfx: 'SFX',
};

// Cross-Studio Import Browser — reads the creator's own generated audio from
// every BASE Station studio and drops it onto the timeline as an audio clip.
export default function AssetImportBrowser({ onImport }) {
  const [assets, setAssets] = useState(null);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');

  const load = async () => {
    setAssets(null);
    try {
      const me = await base44.auth.me();
      const rows = await base44.entities.UserAsset.filter({ user_id: me.id }, '-created_date', 120);
      setAssets(rows.filter(a => a.file_url && AUDIO_TYPES.includes(a.asset_type)));
    } catch {
      setAssets([]);
    }
  };

  useEffect(() => { load(); }, []);

  const shown = useMemo(() => {
    const list = assets || [];
    return list.filter(a =>
      (kind === 'all' || a.asset_type === kind) &&
      (!q || (a.title || '').toLowerCase().includes(q.toLowerCase()))
    ).slice(0, 40);
  }, [assets, q, kind]);

  const kinds = useMemo(() => ['all', ...new Set((assets || []).map(a => a.asset_type))], [assets]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-widest text-white/45 font-mono">Cross-Studio Import</span>
          <InfoTip size="sm" text="Everything you've generated across BASE Station — tracks, stems, masters, loops, SFX — pulled straight onto the timeline. The source file is never modified." />
        </span>
        <button onClick={load} className="text-white/35 hover:text-white"><RefreshCw className="w-3 h-3" /></button>
      </div>

      <div className="relative mb-1.5">
        <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-white/30" />
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search your assets…"
          className="h-7 pl-6 text-[11px] bg-black/40 border-white/10" />
      </div>

      <div className="flex gap-1 flex-wrap mb-2">
        {kinds.map(k => (
          <button key={k} onClick={() => setKind(k)}
            className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase border transition-colors ${
              kind === k ? 'border-[#14b8a6] text-[#14b8a6] bg-[#14b8a6]/10' : 'border-white/10 text-white/40 hover:text-white/70'
            }`}>
            {k}
          </button>
        ))}
      </div>

      {assets === null && (
        <div className="flex items-center gap-2 text-[11px] text-white/40 py-4">
          <Loader2 className="w-3 h-3 animate-spin" /> Reading your library…
        </div>
      )}

      {assets?.length === 0 && (
        <p className="text-[11px] text-white/35 leading-snug py-3">
          No audio in your library yet. Generate a track in Music Studio or Song Maestro and it will appear here.
        </p>
      )}

      <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
        {shown.map(a => (
          <button key={a.id} onClick={() => onImport(a)}
            className="w-full text-left rounded-lg border border-white/8 bg-black/30 hover:border-[#14b8a6]/50 p-2 group transition-colors">
            <div className="flex items-center gap-2">
              <Import className="w-3 h-3 text-white/30 group-hover:text-[#14b8a6] shrink-0" />
              <span className="text-[11px] text-white/80 truncate flex-1">{a.title}</span>
            </div>
            <p className="text-[9px] font-mono text-white/30 mt-0.5 pl-5">
              {SOURCE_LABEL[a.asset_type] || a.asset_type}
              {a.metadata?.bpm ? ` · ${Math.round(a.metadata.bpm)} BPM` : ''}
              {a.metadata?.duration ? ` · ${Math.round(a.metadata.duration)}s` : ''}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}