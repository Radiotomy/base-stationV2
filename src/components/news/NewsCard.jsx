import { ExternalLink, Pin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const CATEGORY_STYLES = {
  legal: 'bg-red-500/10 text-red-300 border-red-500/30',
  policy: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  industry: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
  technology: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  resources: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
};

export default function NewsCard({ article }) {
  return (
    <article className="merc-card merc-card-hover rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className={`uppercase text-[10px] tracking-wider ${CATEGORY_STYLES[article.category] || ''}`}>
          {article.category}
        </Badge>
        {article.region && <span className="text-[11px] text-muted-foreground">{article.region}</span>}
        {article.is_pinned && <Pin className="w-3.5 h-3.5 text-amber-400" />}
        <span className="flex-1" />
        {article.published_date && (
          <time className="text-[11px] text-muted-foreground">{article.published_date}</time>
        )}
      </div>
      <h3 className="font-bold text-foreground text-lg leading-snug">{article.title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{article.summary}</p>
      {article.content && (
        <details className="text-sm text-muted-foreground/90">
          <summary className="cursor-pointer text-xs font-semibold text-amber-300/80 hover:text-amber-300">Read more</summary>
          <p className="mt-2 leading-relaxed whitespace-pre-line">{article.content}</p>
        </details>
      )}
      {article.source_url && (
        <a href={article.source_url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FFC98A] hover:underline">
          <ExternalLink className="w-3 h-3" /> {article.source_name || 'Source'}
        </a>
      )}
    </article>
  );
}