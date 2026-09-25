import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Sparkles, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import LoopCard from './LoopCard';
import IndexLoopsBanner from './IndexLoopsBanner';

const EXAMPLES = [
  'warm dusty break with room on the snare',
  'gritty analog bass, slow and heavy',
  'bright plucked melody, hopeful',
  'lo-fi tape hiss and vinyl crackle',
];

const SCOPES = [
  { key: 'all', label: 'My loops + community' },
  { key: 'mine', label: 'My loops only' },
];

export default function SemanticLoopSearch({ renderExtra }) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('all');
  const [results, setResults] = useState(null);
  const [stats, setStats] = useState(null);
  const [searching, setSearching] = useState(false);

  const search = async (text) => {
    const q = (text ?? query).trim();
    if (!q) return;
    setSearching(true);
    try {
      const res = await base44.functions.invoke('searchLoopsSemantic', { query: q, scope });
      setResults(res.data?.results || []);
      setStats({
        scanned: res.data?.scanned || 0,
        embedded: res.data?.embedded || 0,
        needsIndexing: res.data?.needs_indexing || 0,
      });
    } catch (e) {
      toast.error('Search failed: ' + (e.response?.data?.error || e.message));
    } finally {
      setSearching(false);
    }
  };

  const runExample = (ex) => {
    setQuery(ex);
    search(ex);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Describe the sound you want in plain words — this listens to the audio itself rather than
        matching filenames or tags, so it finds loops nobody labelled properly.
      </p>

      <div className="flex gap-2">
        <Input
          placeholder="e.g. warm dusty break with room on the snare"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
        />
        <Button onClick={() => search()} disabled={searching || !query.trim()}>
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SCOPES.map((s) => (
          <button
            key={s.key}
            onClick={() => setScope(s.key)}
            className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${scope === s.key ? 'border-purple-500 bg-purple-500/10 text-foreground' : 'border-border text-muted-foreground hover:border-border/80'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <IndexLoopsBanner
        needsIndexing={stats?.needsIndexing || 0}
        onIndexed={() => search()}
      />

      {!results && (
        <div className="space-y-2 pt-2">
          <p className="text-xs text-muted-foreground">Try one of these:</p>
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => runExample(ex)}
                className="px-2.5 py-1 rounded-full text-xs border border-border text-muted-foreground hover:border-[#FF9A4D]/50 hover:text-foreground transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {stats && results?.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Best matches from {stats.embedded} indexed loop{stats.embedded === 1 ? '' : 's'}.
        </p>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(results || []).map((r) => (
          <LoopCard
            key={r.id}
            title={r.title}
            subtitle={`${Math.round(r.score * 100)}% match${r.bpm ? ` · ${r.bpm} BPM` : ''}${r.is_mine ? ' · yours' : ''}`}
            audioUrl={r.file_url}
            tags={r.tags}
            license={r.license}
          >
            {renderExtra?.(r)}
          </LoopCard>
        ))}
      </div>

      {results?.length === 0 && !searching && (
        <p className="text-sm text-muted-foreground text-center py-8">
          {stats?.embedded === 0
            ? 'No loops are indexed yet — index your library above to start searching by sound.'
            : 'No close matches. Try describing the texture or feel rather than the instrument.'}
        </p>
      )}
    </div>
  );
}