const SECTIONS = ['Start Building', 'Getting Started', 'Space Dashboard', 'Building Tools', 'Item Settings', 'Space Options', 'Interactive Studio', 'AI Lab'];

export default function GuideSidebar({ pages, activeSlug, onSelect }) {
  return (
    <nav className="space-y-4 md:max-h-[75vh] md:overflow-y-auto pr-1">
      {SECTIONS.map((section) => {
        const items = pages.filter((p) => p.section === section);
        if (!items.length) return null;
        return (
          <div key={section}>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold mb-1">{section}</p>
            {items.map((p) => (
              <button
                key={p.slug}
                onClick={() => onSelect(p.slug)}
                className={`block w-full text-left text-sm px-2 py-1 rounded-md ${p.slug === activeSlug ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {p.title}
              </button>
            ))}
          </div>
        );
      })}
      {!pages.length && <p className="text-sm text-muted-foreground">No matches.</p>}
    </nav>
  );
}