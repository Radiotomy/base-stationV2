import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { ArrowLeft, Newspaper, Scale, ShieldCheck } from 'lucide-react';
import NewsCard from '@/components/news/NewsCard';

const CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'legal', label: '⚖️ Legal' },
  { value: 'policy', label: '📋 Policy & Rules' },
  { value: 'industry', label: '🏢 Industry' },
  { value: 'technology', label: '🚀 Technology' },
  { value: 'resources', label: '🧰 Resources' },
];

export default function NewsHub() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');

  useEffect(() => {
    let alive = true;
    base44.entities.NewsArticle.filter({ status: 'published' }, '-published_date', 100)
      .then((rows) => { if (alive) setArticles(rows); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const list = category === 'all' ? articles : articles.filter((a) => a.category === category);
    return [...list].sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0));
  }, [articles, category]);

  return (
    <div className="min-h-screen bg-background pt-20 pb-16 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="space-y-3">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm font-semibold">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-bold tracking-wider uppercase text-[#FFC98A]">
            <Newspaper className="w-3.5 h-3.5" /> AI Music News & Legal Hub
          </div>
          <h1 className="font-display text-4xl md:text-5xl text-white">News &amp; Legal Hub</h1>
          <p className="text-muted-foreground max-w-2xl">
            The latest verified news on AI music legality — lawsuits, laws, platform rules, labeling
            standards, new technology, and resources for creators and developers. Curated and
            refreshed daily by our AI news curator, with every story linked to its original source.
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Source-verified</span>
            <span className="inline-flex items-center gap-1.5"><Scale className="w-3.5 h-3.5 text-amber-400" /> Legal &amp; policy focus</span>
          </div>
        </header>

        {/* Category filter */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button key={c.value} onClick={() => setCategory(c.value)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all ${
                category === c.value
                  ? 'merc-button border-transparent'
                  : 'merc-button-dark text-muted-foreground hover:text-foreground'
              }`}>
              {c.label}
            </button>
          ))}
        </div>

        {/* Articles */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#FF9A4D]/30 border-t-[#FF9A4D] rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="merc-card rounded-2xl p-10 text-center text-muted-foreground text-sm">
            No articles in this category yet — the curator refreshes the hub daily. Check back soon.
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((a) => <NewsCard key={a.id} article={a} />)}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
          This hub is an informational resource, not legal advice. Stories are gathered from
          reputable public sources and linked for verification. Always consult the original source
          and your own counsel for legal decisions.
        </p>
      </div>
    </div>
  );
}