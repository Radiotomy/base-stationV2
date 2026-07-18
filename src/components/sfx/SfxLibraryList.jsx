import { Volume2 } from 'lucide-react';

export default function SfxLibraryList({ items }) {
  if (!items?.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase">Your Sound Effects</p>
      {items.map((a) => (
        <div key={a.id} className="rounded-xl bg-card border border-border p-3 space-y-2">
          <p className="text-xs font-bold text-foreground flex items-center gap-1.5 truncate">
            <Volume2 className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" /> {a.title}
          </p>
          <audio controls className="w-full rounded-lg h-9" src={a.file_url} />
        </div>
      ))}
    </div>
  );
}