import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ClipboardPaste, Upload, Sparkles, Lightbulb, ChevronsDown, PenLine } from 'lucide-react';
import { toast } from 'sonner';
import VoiceDictation from '@/components/songwriting/VoiceDictation';

/**
 * Manual Writer power tools — for writers who want to write it themselves.
 * Paste from any app, import .txt files, live counts, and light-touch AI assists.
 */
export default function ManualWriterPanel({ lyrics, setLyrics, pushVersion }) {
  const [busy, setBusy] = useState(null);
  const [rhymes, setRhymes] = useState([]);
  const fileRef = useRef(null);

  const words = lyrics.trim() ? lyrics.trim().split(/\s+/).length : 0;
  const lines = lyrics.trim() ? lyrics.split('\n').filter(l => l.trim()).length : 0;

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) { toast.error('Clipboard is empty'); return; }
      if (lyrics.trim()) pushVersion();
      setLyrics(lyrics.trim() ? `${lyrics.replace(/\s+$/, '')}\n\n${text}` : text);
      toast.success('Pasted from clipboard');
    } catch {
      toast.error('Clipboard blocked by browser — use ⌘V / long-press paste inside the editor');
    }
  };

  const importTxt = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (lyrics.trim()) pushVersion();
      setLyrics(String(reader.result || ''));
      toast.success(`Imported ${file.name}`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const assist = async (kind) => {
    if (!lyrics.trim()) { toast.error('Write or paste some lyrics first'); return; }
    setBusy(kind);
    try {
      if (kind === 'rhymes') {
        const lastLine = lyrics.trim().split('\n').filter(l => l.trim() && !l.trim().startsWith('[')).pop() || '';
        const res = await base44.integrations.Core.InvokeLLM({
          prompt: `You are a songwriting assistant. The writer's current last lyric line is: "${lastLine}". Suggest 6 short rhyme or near-rhyme word/phrase ideas that could end the NEXT line. Each under 6 words.`,
          response_json_schema: { type: 'object', properties: { ideas: { type: 'array', items: { type: 'string' } } } },
        });
        setRhymes(res.ideas || []);
        if (!res.ideas?.length) toast.error('No ideas came back — try again');
      } else if (kind === 'continue') {
        const res = await base44.integrations.Core.InvokeLLM({
          prompt: `You are a songwriting assistant. Continue these lyrics with 2-4 more lines matching the existing voice, rhyme feel and current section. Return ONLY the new lines, no commentary:\n\n${lyrics.slice(-1500)}`,
        });
        if (res?.trim()) {
          pushVersion();
          setLyrics(`${lyrics.replace(/\s+$/, '')}\n${res.trim()}`);
          toast.success('Added a few lines — edit them freely');
        }
      } else if (kind === 'polish') {
        const res = await base44.integrations.Core.InvokeLLM({
          prompt: `You are a light-touch lyric editor. Gently polish these lyrics — fix awkward phrasing and tighten rhythm — while preserving the writer's own words, meaning, structure tags and voice as much as possible. Return ONLY the lyrics:\n\n${lyrics}`,
        });
        if (res?.trim()) {
          pushVersion();
          setLyrics(res.trim());
          toast.success('Polished — your previous version is in history');
        }
      }
    } catch (err) {
      toast.error(err?.message || 'Assist failed');
    }
    setBusy(null);
  };

  return (
    <div className="space-y-4 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
      <p className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
        <PenLine className="w-3.5 h-3.5" /> Manual Writer Tools
      </p>
      <p className="text-[11px] text-muted-foreground leading-snug">
        You write, we stay out of the way. Bring lyrics in from Notes, Docs, or any app — and take them anywhere.
      </p>

      {/* Bring content in */}
      <div className="grid grid-cols-2 gap-1.5">
        <Button size="sm" variant="outline" onClick={pasteFromClipboard} className="rounded-xl gap-1.5 text-xs h-9">
          <ClipboardPaste className="w-3.5 h-3.5" /> Paste In
        </Button>
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} className="rounded-xl gap-1.5 text-xs h-9">
          <Upload className="w-3.5 h-3.5" /> Import .txt
        </Button>
        <input ref={fileRef} type="file" accept=".txt,.md,text/plain" onChange={importTxt} className="hidden" />
      </div>

      {/* Voice dictation — sing/speak lyrics, structure & notes */}
      <VoiceDictation
        onTranscript={(text) => {
          if (lyrics.trim()) pushVersion();
          setLyrics(lyrics.trim() ? `${lyrics.replace(/\s+$/, '')}\n\n${text}` : text);
        }}
      />

      {/* Live counts */}
      <div className="flex gap-3 text-[11px] text-muted-foreground font-semibold">
        <span>{words.toLocaleString()} words</span>
        <span>·</span>
        <span>{lines} lines</span>
        <span>·</span>
        <span>{lyrics.length.toLocaleString()} chars</span>
      </div>

      {/* Basic AI assistance */}
      <div className="pt-2 border-t border-emerald-500/15 space-y-1.5">
        <p className="text-[10px] font-bold text-muted-foreground uppercase">Basic AI Assist — optional</p>
        <div className="grid grid-cols-1 gap-1.5">
          <Button size="sm" variant="outline" onClick={() => assist('rhymes')} disabled={!!busy}
            className="rounded-xl gap-1.5 text-xs justify-start h-9">
            <Lightbulb className="w-3.5 h-3.5 text-yellow-400" /> {busy === 'rhymes' ? 'Thinking…' : 'Rhyme ideas for my last line'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => assist('continue')} disabled={!!busy}
            className="rounded-xl gap-1.5 text-xs justify-start h-9">
            <ChevronsDown className="w-3.5 h-3.5 text-cyan-400" /> {busy === 'continue' ? 'Writing…' : 'Suggest the next few lines'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => assist('polish')} disabled={!!busy}
            className="rounded-xl gap-1.5 text-xs justify-start h-9">
            <Sparkles className="w-3.5 h-3.5 text-pink-400" /> {busy === 'polish' ? 'Polishing…' : 'Light polish (keeps my words)'}
          </Button>
        </div>
      </div>

      {/* Rhyme suggestions */}
      {rhymes.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Rhyme ideas — tap to append</p>
          <div className="flex flex-wrap gap-1.5">
            {rhymes.map(r => (
              <button key={r} type="button"
                onClick={() => { setLyrics(`${lyrics.replace(/\s+$/, '')}\n${r}`); }}
                className="px-2 py-1 rounded-lg bg-muted text-xs text-muted-foreground hover:bg-emerald-500/20 hover:text-emerald-300 transition-all">
                {r}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}