export default function CategoryCard({ c }) {
  return (
    <div className="merc-card merc-card-hover rounded-2xl p-6 transition">
      <p className="text-sm font-bold text-accent">{c.num} · {c.title}</p>
      <h3 className="mt-2 text-2xl font-display">{c.short}</h3>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{c.blurb}</p>
      <ul className="mt-4 space-y-1.5">
        {c.features.map((f) => (
          <li key={f} className="flex gap-2 text-sm text-foreground/85">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />{f}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-muted-foreground">{c.routes.join(' · ')}</p>
    </div>
  );
}