import { CheckCircle2, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

const STEPS = [
  {
    n: 1,
    title: 'Pick your topic & vibe',
    body: 'Open the Lyrics Studio. Type a single concrete topic (e.g. "long-distance love" — not "love"). Pick 1–2 moods and a style. Specificity = better songs.',
    link: '/lyrics-studio',
    linkLabel: 'Open Lyrics Studio →',
  },
  {
    n: 2,
    title: 'Generate strong lyrics',
    body: 'Toggle "Pro Songwriter" ON for chart-grade rhyme & prosody. Add a reference artist (e.g. "Tyler Childers") and the engine auto-fills BPM, style and rhyme scheme. Generate, then refine — verses tell, choruses repeat the hook.',
  },
  {
    n: 3,
    title: 'Send to Music Studio',
    body: 'Hit "Send to Music Studio →" at the bottom of the lyrics editor. Your lyrics, genre, and topic auto-fill the Advanced Generate tab.',
    link: '/music-studio',
    linkLabel: 'Open Music Studio →',
  },
  {
    n: 4,
    title: 'Generate music with the right provider',
    body: 'Use Sonic v4-5 for vocal tracks, Tempolor for genre fidelity & long-form, Producer for instrumentals. Add a Sound Prompt that describes instruments + atmosphere (e.g. "acoustic guitar, brushed snare, warm Wurlitzer, late-night intimate").',
  },
  {
    n: 5,
    title: 'Master & polish',
    body: 'Send the result into Mastering Studio. Pick "Streaming" for Spotify/Apple Music (-14 LUFS), "Club" for DJ sets (-7 LUFS), or "Vinyl" for analog warmth (-16 LUFS).',
    link: '/mastering-studio',
    linkLabel: 'Open Mastering Studio →',
  },
  {
    n: 6,
    title: 'Cover art + visualizer',
    body: 'Generate matching cover art (Cheap mode for quick options, Modest for custom prompts). Then drop the track into Visualizer Studio for an animated music video.',
    link: '/cover-art-studio',
    linkLabel: 'Open Cover Art Studio →',
  },
  {
    n: 7,
    title: 'Publish, register & manage rights',
    body: 'Submit the finished track to charts/playlists, register on-chain for permanent provenance, then manage DDEX exports and verification status from the Rights Portal.',
    link: '/submit',
    linkLabel: 'Submit Track →',
  },
];

export default function TutorialWalkthrough() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-amber-400" />
        <h2 className="text-xl font-black text-foreground">Your first track in 7 steps</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Follow these in order. The whole pipeline takes ~15 minutes for a first-draft song.
      </p>
      <div className="space-y-2 mt-4">
        {STEPS.map((s) => (
          <div key={s.n} className="bg-card border border-border rounded-2xl p-4 flex gap-4">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center font-black text-white flex-shrink-0">
              {s.n}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-foreground text-sm flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> {s.title}
              </p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{s.body}</p>
              {s.link && (
                <Link to={s.link} className="inline-block mt-2 text-xs font-bold text-purple-400 hover:text-purple-300">
                  {s.linkLabel}
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}