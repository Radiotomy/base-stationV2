import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, ArrowLeft, BookOpen, Music, Mic2, Palette, Film, Sparkles,
  Wand2, Coins, Zap, Globe, Volume2, Shield
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import HelpSection from '@/components/help/HelpSection';
import TutorialWalkthrough from '@/components/help/TutorialWalkthrough';
import ProTips from '@/components/help/ProTips';

const SECTIONS = [
  {
    id: 'music',
    title: 'Music Studio — generating tracks',
    icon: Music,
    keywords: 'music generate sonic tempolor producer ai song track',
    body: (
      <>
        <p><strong className="text-foreground">Quick Generate</strong> auto-routes to the best provider for your inputs. Just type a sound prompt + pick mood/genre, and we choose Sonic, Tempolor, or Producer for you.</p>
        <p><strong className="text-foreground">Advanced Generate</strong> gives you full control: pick the provider, model version, BPM, voice persona, and attach your own lyrics.</p>
        <p><strong className="text-foreground">Providers at a glance:</strong></p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Sonic v4-5+</strong> — vocal tracks. Custom mode for lyrics; auto-lyrics if you only have a vibe.</li>
          <li><strong>Tempolor v4.6 / i3.5</strong> — strong genre fidelity, instrumental or vocal, supports cover mode.</li>
          <li><strong>Producer (FUZZ-2.0)</strong> — instrumentals with quick turnaround.</li>
        </ul>
        <p><strong className="text-foreground">Sound prompt tips:</strong> describe instruments + atmosphere ("808 sub, brushed snare, distant choir, late-night intimate") — not just genre. 200–400 chars is the sweet spot.</p>
      </>
    ),
  },
  {
    id: 'lyrics',
    title: 'Lyrics Studio — writing lyrics',
    icon: Mic2,
    keywords: 'lyrics writing pro songwriter rhyme scheme structure',
    body: (
      <>
        <p>Pick a <strong className="text-foreground">topic</strong> (one concrete concept), 1–2 moods, and a style. Hit Generate.</p>
        <p><strong className="text-foreground">Pro Songwriter ON</strong> activates Nashville/LA-grade rhyme craft. Add a reference artist — the writer lookup auto-fills mood, style, rhyme scheme & BPM.</p>
        <p><strong className="text-foreground">Rhyme schemes:</strong> Mixed is the safest hit-song default. ABAB = pop alternating, AABB = couplets, XAXA = conversational/modern, AAAA = monorhyme tension.</p>
        <p><strong className="text-foreground">Structure templates</strong> give you proven section maps per genre (Standard Pop, Hip-Hop, Red Dirt Country, EDM Drop, Neo-Soul, etc.).</p>
        <p>When done, hit <strong className="text-foreground">"Send to Music Studio →"</strong> — lyrics, genre and topic auto-fill the next step.</p>
        <p className="text-xs">Shortcuts: ⌘+Enter generate · ⌘+S save · ⌘+K shortcut panel.</p>
      </>
    ),
  },
  {
    id: 'cover',
    title: 'Cover Art Studio',
    icon: Palette,
    keywords: 'cover art album artwork image prompt variations',
    body: (
      <>
        <p><strong className="text-foreground">Cheap mode (1 credit)</strong> — quick auto-generated cover from Genre + Mood + Style chips. Good for quick options.</p>
        <p><strong className="text-foreground">Modest mode (3 credits)</strong> — custom prompt for higher-quality, intentional designs. Reference a real visual style for best results ("in the style of a Blue Note 1972 jazz cover").</p>
        <p>Hit <strong className="text-foreground">Generate Variations</strong> to produce 3 alternates and pick your favorite.</p>
      </>
    ),
  },
  {
    id: 'video',
    title: 'Video Studio — AI music videos',
    icon: Film,
    keywords: 'video ltx text image audio cinematic visualizer',
    body: (
      <>
        <p>Three modes:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Text to Video</strong> — describe the scene; LTX renders it.</li>
          <li><strong>Image to Video</strong> — upload a reference still, animate it.</li>
          <li><strong>Audio to Video</strong> — upload a track, get a synced visual.</li>
        </ul>
        <p><strong className="text-foreground">Aspect ratio matters:</strong> 9:16 for Reels/TikTok, 16:9 for YouTube, 1:1 for IG feed.</p>
        <p>Prompts should describe <strong className="text-foreground">motion, lighting, and atmosphere</strong>, not just objects. "Slow zoom through neon city rain at 3 AM" beats "city at night".</p>
        <p>Duration: 5s for quick tests, 10–15s for proper visualizers. Render time ≈ 12s per second of video.</p>
      </>
    ),
  },
  {
    id: 'mastering',
    title: 'Mastering Studio',
    icon: Sparkles,
    keywords: 'mastering lufs streaming club vinyl warm',
    body: (
      <>
        <p>Pick the loudness target that matches where the track will live:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Streaming (-14 LUFS)</strong> — Spotify, Apple Music, YouTube. Use this 90% of the time.</li>
          <li><strong>Loud (-8 LUFS)</strong> — maximum punch, may sound harsh on streaming.</li>
          <li><strong>Balanced (-12 LUFS)</strong> — versatile, preserves dynamics.</li>
          <li><strong>Warm (-13 LUFS)</strong> — analog character, smooth tops.</li>
          <li><strong>Club (-7 LUFS)</strong> — bass-forward, DJ-ready.</li>
          <li><strong>Vinyl (-16 LUFS)</strong> — wide dynamic range for physical cuts.</li>
        </ul>
        <p>The AI Mastering panel inside <Link to="/creator-dashboard" className="text-purple-400 hover:underline">My Studio → Mastering tab</Link> exposes finer controls — EQ, bass/punch/space sliders, and stereo VU meters with peak hold.</p>
      </>
    ),
  },
  {
    id: 'visualizer',
    title: 'Visualizer Studio',
    icon: Wand2,
    keywords: 'visualizer spectrum particles waveform reactive',
    body: (
      <>
        <p>Drop in any track (from your library or direct PC upload) and pick an animation style.</p>
        <p><strong className="text-foreground">Tip:</strong> uploading direct from PC gives the best audio-reactive results — library tracks served from CloudFront may fall back to synthetic mode due to CORS.</p>
        <p>Styles: <strong>Spectrum</strong> (frequency bars), <strong>Particles</strong> (flowing field), <strong>Waveform</strong> (clean pulse), <strong>Liquid</strong> (reactive metal), <strong>Cinematic</strong> (AI film loop), <strong>Retro</strong> (VHS glitch).</p>
      </>
    ),
  },
  {
    id: 'voice',
    title: 'Voice Creator',
    icon: Volume2,
    keywords: 'voice persona synthesis singer character',
    body: (
      <>
        <p>Build a reusable <strong className="text-foreground">voice persona</strong> with voice type, age, and character traits. Save it once, then reuse across every Music Studio generation for consistent artist identity.</p>
        <p>Test personas live with the synthesis panel — type any phrase and hear how the voice handles it before committing to a full track.</p>
      </>
    ),
  },
  {
    id: 'credits',
    title: 'Credits & pricing',
    icon: Coins,
    keywords: 'credits pricing cost plans subscription',
    body: (
      <>
        <p>Credits power every generation. Approximate costs:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Lyrics: 2 credits</li>
          <li>Music (Sonic/Tempolor/Producer): 10 credits per track</li>
          <li>Cover art: 1 (Cheap) / 3 (Modest)</li>
          <li>Video (LTX): 15 credits</li>
          <li>Visualizer: 12 credits</li>
        </ul>
        <p>Check your balance in the header. <Link to="/credits" className="text-purple-400 hover:underline">Buy more credits →</Link></p>
      </>
    ),
  },
  {
    id: 'blockchain',
    title: 'Blockchain registry',
    icon: Shield,
    keywords: 'blockchain base solana ipfs nft registry provenance',
    body: (
      <>
        <p>Register finished tracks on Base (EVM) or Solana for immutable provenance. The registry stores a SHA-256 fingerprint + metadata URI (pinned to IPFS).</p>
        <p>Use this to claim ownership of AI-assisted work before publishing publicly. <Link to="/blockchain" className="text-purple-400 hover:underline">Open Blockchain Registry →</Link></p>
      </>
    ),
  },
  {
    id: 'publish',
    title: 'Publishing & distribution',
    icon: Globe,
    keywords: 'publish audius distribute submit track charts',
    body: (
      <>
        <p>Three ways to publish:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Submit Track</strong> — enter the public charts and playlists on BaseStation.</li>
          <li><strong>Publish to Audius</strong> — push to the Audius decentralized network from any finished asset.</li>
          <li><strong>Live Studio</strong> — go live with a co-listening session for your fans, with reactions, chat, tipping, and collectible drops.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'shortcuts',
    title: 'Keyboard shortcuts',
    icon: Zap,
    keywords: 'shortcuts keyboard hotkey command',
    body: (
      <>
        <ul className="list-disc pl-5 space-y-1">
          <li><kbd className="bg-muted px-1.5 py-0.5 rounded text-xs">⌘ / Ctrl + Enter</kbd> — Generate from any studio</li>
          <li><kbd className="bg-muted px-1.5 py-0.5 rounded text-xs">⌘ / Ctrl + S</kbd> — Save current work to library</li>
          <li><kbd className="bg-muted px-1.5 py-0.5 rounded text-xs">⌘ / Ctrl + K</kbd> — Toggle shortcuts panel</li>
        </ul>
      </>
    ),
  },
];

export default function Help() {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return SECTIONS;
    return SECTIONS.filter((s) =>
      s.title.toLowerCase().includes(term) ||
      s.keywords.toLowerCase().includes(term)
    );
  }, [q]);

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-16 inset-x-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/50 px-6 h-12 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-semibold">Back</span>
        </Link>
        <div className="flex-1" />
        <BookOpen className="w-4 h-4 text-purple-400" />
        <span className="text-sm font-bold">Help & How-To</span>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden pt-24 pb-10 px-6 bg-gradient-to-br from-purple-900/30 to-black">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-black text-white mb-3 tracking-tight">
            📚 Help & How-To
          </h1>
          <p className="text-white/60 text-base md:text-lg max-w-2xl">
            Everything you need to go from a blank screen to a published track — step-by-step.
          </p>
          <div className="relative mt-6 max-w-xl">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search help (e.g. lyrics, LUFS, video, credits)…"
              className="pl-9 h-11 rounded-xl bg-card/60 border-white/10"
            />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Tutorial */}
        <div>
          <TutorialWalkthrough />
        </div>

        {/* Pro tips */}
        <div>
          <ProTips />
        </div>
      </div>

      {/* Searchable sections */}
      <div className="max-w-4xl mx-auto px-6 pb-16">
        <h2 className="text-xl font-black text-foreground mb-4">Full reference</h2>
        <div className="space-y-2">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">No sections match "{q}".</p>
          )}
          {filtered.map((s, i) => (
            <HelpSection key={s.id} id={s.id} title={s.title} icon={s.icon} defaultOpen={i === 0 && !q}>
              {s.body}
            </HelpSection>
          ))}
        </div>
      </div>
    </div>
  );
}