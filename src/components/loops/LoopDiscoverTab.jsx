import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import LoopCard from './LoopCard';

const CATEGORIES = ['loop', 'drum loop', 'bass loop', 'melodic loop', 'vocal chop', 'fx', 'one shot'];

export default function LoopDiscoverTab() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [importingId, setImportingId] = useState(null);

  const search = async () => {
    setSearching(true);
    try {
      const res = await base44.functions.invoke('searchFreesoundSounds', { query, category });
      setResults(res.data?.results || []);
    } catch (e) {
      toast.error('Search failed: ' + e.message);
    } finally {
      setSearching(false);
    }
  };

  const importSound = async (sound) => {
    setImportingId(sound.id);
    try {
      await base44.functions.invoke('importFreesoundSound', {
        sound_id: sound.id,
        name: sound.name,
        username: sound.username,
        license: sound.license,
        preview_url: sound.preview_url,
        duration: sound.duration,
        tags: sound.tags,
        url: sound.url,
        category: category ? category.replace(' ', '_') : 'sample',
        collection_name: 'Freesound Import',
        make_public: false,
      });
      toast.success('Saved to My Loops');
    } catch (e) {
      toast.error('Import failed: ' + e.message);
    } finally {
      setImportingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Search free, royalty-free loops and samples from Freesound.org. Save any sound to your
        library — CC-BY sounds keep their required attribution automatically.
      </p>
      <div className="flex gap-2">
        <Input
          placeholder="Search loops, drums, bass…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
        />
        <Button onClick={search} disabled={searching}>
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(category === c ? '' : c)}
            className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${category === c ? 'border-purple-500 bg-purple-500/10 text-foreground' : 'border-border text-muted-foreground hover:border-border/80'}`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {results.map((r) => (
          <LoopCard
            key={r.id}
            title={r.name}
            subtitle={`by ${r.username} · ${r.duration?.toFixed(1)}s`}
            audioUrl={r.preview_url}
            tags={r.tags}
            license={r.license}
            onAction={() => importSound(r)}
            actionLabel="Save to My Loops"
            actionLoading={importingId === r.id}
          />
        ))}
        {!searching && results.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full text-center py-8">
            Search above to discover free loops and samples.
          </p>
        )}
      </div>
    </div>
  );
}