import { useState, useEffect, useMemo } from 'react';
import { Loader2, ExternalLink, Search } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import GuideSidebar from '@/components/live/guide/GuideSidebar';

export default function VenueBuildGuide() {
  const [pages, setPages] = useState(null);
  const [activeSlug, setActiveSlug] = useState(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    base44.entities.PortalsDocPage.list('order', 200).then((rows) => {
      setPages(rows);
      setActiveSlug(rows[0]?.slug || null);
    });
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return pages || [];
    return (pages || []).filter((p) => p.title.toLowerCase().includes(term) || (p.content || '').toLowerCase().includes(term));
  }, [pages, q]);

  const page = (pages || []).find((p) => p.slug === activeSlug);

  if (pages === null) {
    return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="text-4xl font-display">Venue Build Guide</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Reference for building and decorating your 3D venue in Portals: tools, item settings, space options and the AI Lab model generator.
        </p>
        <div className="relative mt-5 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the guide" className="pl-9" />
        </div>
        <div className="grid md:grid-cols-[240px_1fr] gap-6 mt-6">
          <GuideSidebar pages={filtered} activeSlug={activeSlug} onSelect={setActiveSlug} />
          <article className="merc-card rounded-2xl p-6 min-w-0">
            {page ? (
              <>
                <div className="prose prose-invert max-w-none prose-sm">
                  <ReactMarkdown>{page.content}</ReactMarkdown>
                </div>
                <a href={page.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-6">
                  View original on Portals <ExternalLink className="w-3 h-3" />
                </a>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">Pick a page from the list.</p>
            )}
          </article>
        </div>
      </div>
    </div>
  );
}