import { Heart, Mic2 } from "lucide-react";

export default function ProfileModeChooser({ onChoose, busy }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-black text-foreground mb-2">Welcome to Base Station</h1>
          <p className="text-muted-foreground text-sm">How do you want to experience the platform? You can change this anytime.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => onChoose("fan")}
            disabled={busy}
            className="rounded-2xl border border-border bg-card p-8 text-left hover:border-pink-500/50 transition-all group disabled:opacity-50"
          >
            <div className="w-12 h-12 rounded-2xl bg-pink-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Heart className="w-6 h-6 text-pink-400" />
            </div>
            <h2 className="text-xl font-black text-foreground mb-1">I'm a Fan</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Discover artists, follow your favorites, join fan clubs, claim collectibles, and catch live shows. No artist profile needed.
            </p>
          </button>
          <button
            onClick={() => onChoose("creator")}
            disabled={busy}
            className="rounded-2xl border border-border bg-card p-8 text-left hover:border-[#FF9A4D]/50 transition-all group disabled:opacity-50"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#FF9A4D]/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Mic2 className="w-6 h-6 text-[#FF9A4D]" />
            </div>
            <h2 className="text-xl font-black text-foreground mb-1">I'm a Creator</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Set up your artist identity, create music in the AI studios, submit tracks, go live, and build your fanbase.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}