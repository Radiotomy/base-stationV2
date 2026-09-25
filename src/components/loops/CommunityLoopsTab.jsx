import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import LoopCard from './LoopCard';

export default function CommunityLoopsTab({ renderExtra }) {
  const [loops, setLoops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const items = await base44.entities.LoopSample.filter({ is_public: true }, '-created_date', 200);
        setLoops(items);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = loops.filter((l) =>
    !query ||
    l.title?.toLowerCase().includes(query.toLowerCase()) ||
    (l.tags || []).some((t) => t.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Loops and samples shared publicly by the community and BASE Station collections.
      </p>
      <Input placeholder="Search community loops…" value={query} onChange={(e) => setQuery(e.target.value)} />
      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No public loops yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((l) => (
            <LoopCard
              key={l.id}
              title={l.title}
              subtitle={`${l.category} · by ${l.user_name || 'BASE Station'}`}
              audioUrl={l.file_url}
              tags={l.tags}
              license={l.license}
              attribution={l.attribution}
            >
              {renderExtra?.(l)}
            </LoopCard>
          ))}
        </div>
      )}
    </div>
  );
}