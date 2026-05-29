import { Flame } from 'lucide-react';

const TIPS = [
  {
    cat: 'Prompt craft',
    items: [
      'Describe **instruments + atmosphere**, not just genre — "808 sub, hi-hat triplets, distant choir, foggy 3 AM" beats "trap beat" every time.',
      'Stack 2–3 moods (e.g. "Melancholic + Triumphant") for emotional contrast that hooks listeners.',
      'Cap your prompt around 200–400 chars. Longer prompts confuse the model.',
    ],
  },
  {
    cat: 'Lyrics that win',
    items: [
      'One concrete image per verse beats five vague lines. Specifics = memorable.',
      'Chorus = the hook. Repeat it 2–4 times verbatim. Don\'t paraphrase.',
      'Use the "Pro Songwriter" toggle for prosody-locked rhyme & syllable matching.',
      'Reference an artist you love — the writer-style lookup auto-tunes everything.',
    ],
  },
  {
    cat: 'Genre × BPM sweet spots',
    items: [
      'Hip-Hop: 70–90 BPM (laid-back) or 140–160 (drill/trap, half-time feel).',
      'Pop: 100–128 BPM is the radio zone.',
      'EDM/House: 120–128 BPM. Drum & bass: 170–175.',
      'Country/Red Dirt: 80–110 BPM, 4/4, 16-bar verses.',
      'Lo-fi: 70–85 BPM, swung hats, vinyl crackle in the prompt.',
    ],
  },
  {
    cat: 'Mastering targets',
    items: [
      'Spotify / Apple Music / YouTube: **-14 LUFS** (Streaming preset).',
      'Club / DJ sets: -7 to -8 LUFS (Loud or Club preset).',
      'Vinyl / mastering for cuts: -16 LUFS, preserve dynamic range.',
      'If the master feels "flat", try the Warm preset before re-rendering — same loudness, more body.',
    ],
  },
  {
    cat: 'Cover art that sells',
    items: [
      'Use "Modest" mode with a custom prompt naming a real visual reference (e.g. "in the style of a 1970s Blue Note album cover").',
      'Generate 3 variations, then pick the one with the strongest focal point.',
      'High contrast + one bold color = thumbnail readability.',
    ],
  },
  {
    cat: 'Video & visualizers',
    items: [
      'For audio-reactive visualizers, upload tracks directly from your PC — CloudFront-hosted library files may fall back to synthetic mode.',
      'Match aspect ratio to the platform: 9:16 for TikTok/Reels, 16:9 for YouTube, 1:1 for IG feed.',
      'Keep video prompts short and motion-focused: "slow zoom", "drifting clouds", "pulsing light".',
    ],
  },
  {
    cat: 'Workflow shortcuts',
    items: [
      '⌘+Enter generates from any studio. ⌘+S saves to library. ⌘+K shows shortcuts.',
      'Use Templates (Standard Pop, Hip-Hop, etc.) in Lyrics Studio to skip blank-page paralysis.',
      'Build a Voice Persona once, reuse it across every track for a consistent artist voice.',
    ],
  },
];

export default function ProTips() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Flame className="w-5 h-5 text-orange-400" />
        <h2 className="text-xl font-black text-foreground">Pro tips — what makes the best songs</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Real practices from hit-making producers, applied to the BaseStation toolchain.
      </p>
      <div className="space-y-3 mt-4">
        {TIPS.map((t) => (
          <div key={t.cat} className="bg-card border border-border rounded-2xl p-4">
            <p className="font-bold text-foreground text-sm mb-2">{t.cat}</p>
            <ul className="space-y-1.5">
              {t.items.map((it, i) => (
                <li key={i} className="flex gap-2 text-xs text-muted-foreground leading-relaxed">
                  <span className="text-orange-400 flex-shrink-0">•</span>
                  <span dangerouslySetInnerHTML={{ __html: it.replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground">$1</strong>') }} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}