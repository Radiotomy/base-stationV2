import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sparkles } from 'lucide-react';

/**
 * Curated scene-prompt packs for one-click storyboard creation.
 * Picking a template replaces the current scene list.
 */
const TEMPLATES = [
  {
    id: 'urban_night',
    name: 'Urban Night',
    emoji: '🌃',
    description: 'Neon-soaked city storytelling',
    scenes: [
      'neon city street rain',
      'subway train motion blur',
      'cocktail bar slow motion',
      'rooftop skyline night',
      'crowded sidewalk neon signs',
    ],
  },
  {
    id: 'nature_chill',
    name: 'Nature Chill',
    emoji: '🌅',
    description: 'Soft organic visuals',
    scenes: [
      'ocean waves sunset golden',
      'forest fog morning light',
      'mountain peaks aerial',
      'wildflowers field breeze',
      'campfire embers night',
    ],
  },
  {
    id: 'glitch_cyber',
    name: 'Glitch Cyber',
    emoji: '⚡',
    description: 'High-energy electronic',
    scenes: [
      'glitch art digital distortion',
      'data center server racks',
      'cyberpunk hologram interface',
      'circuit board macro',
      'vhs static tv screen',
    ],
  },
  {
    id: 'travel_film',
    name: 'Travel Film',
    emoji: '✈️',
    description: 'Cinematic globetrotter',
    scenes: [
      'airplane window clouds',
      'tropical beach drone aerial',
      'old town european cobblestone',
      'desert sand dunes sunset',
      'mountain hiking landscape',
    ],
  },
  {
    id: 'studio_dark',
    name: 'Studio Dark',
    emoji: '🎙️',
    description: 'Moody performance footage',
    scenes: [
      'studio microphone spotlight',
      'vinyl record spinning closeup',
      'mixing board led lights',
      'silhouette singer stage',
      'guitar strings macro',
    ],
  },
  {
    id: 'abstract_motion',
    name: 'Abstract Motion',
    emoji: '🌀',
    description: 'Particles, ink, energy',
    scenes: [
      'abstract particles flowing',
      'ink water swirl macro',
      'smoke plume slow motion',
      'liquid metal ripple',
      'fire embers slow motion',
    ],
  },
];

export default function SceneTemplatesPicker({ open, onClose, onPick }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> Scene Templates
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Pick a vibe — we'll load a 5-scene storyboard. You can tweak each scene after.
          </p>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { onPick(t.scenes); onClose(); }}
              className="text-left p-4 rounded-xl border border-border bg-card hover:border-indigo-500 hover:bg-indigo-500/5 transition-all space-y-1"
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{t.emoji}</span>
                <span className="font-bold text-sm text-foreground">{t.name}</span>
              </div>
              <p className="text-xs text-muted-foreground">{t.description}</p>
              <p className="text-[10px] text-muted-foreground/70 truncate">
                {t.scenes.length} scenes · {t.scenes[0]}…
              </p>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}