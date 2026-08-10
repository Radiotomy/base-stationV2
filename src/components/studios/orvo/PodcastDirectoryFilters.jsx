import { Search } from 'lucide-react';

export const CATEGORIES = [
  'all', 'music', 'technology', 'culture', 'comedy', 'news',
  'education', 'business', 'arts', 'sports', 'health', 'true_crime', 'other',
];

const chip = (active) =>
  `px-3 py-1.5 rounded-full text-xs font-bold border whitespace-nowrap transition-all ${
    active
      ? 'text-[#2A1508] border-black bg-gradient-to-b from-[#FFC26E] to-[#FF9A4D]'
      : 'text-white/55 border-white/10 bg-black/30 hover:text-[#FF9A4D]'
  }`;

export default function PodcastDirectoryFilters({ query, onQuery, category, onCategory }) {
  return (
    <div className="space-y-3 mb-8">
      <div className="relative">
        <Search className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search podcasts…"
          className="w-full bg-black/40 border border-white/10 rounded-full pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF9A4D]/60"
        />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => onCategory(c)} className={chip(category === c)}>
            {c === 'all' ? 'All' : c.replace('_', ' ')}
          </button>
        ))}
      </div>
    </div>
  );
}