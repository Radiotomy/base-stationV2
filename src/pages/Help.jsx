import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, ArrowLeft, BookOpen, Music, Mic2, Palette, Film, Sparkles,
  Wand2, Coins, Zap, Globe, Volume2, Shield, Fingerprint, Radio, Scale,
  Layers, FileCheck, ScanLine, Users, Heart, Lock, Cpu
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import HelpSection from '@/components/help/HelpSection';
import TutorialWalkthrough from '@/components/help/TutorialWalkthrough';
import ProTips from '@/components/help/ProTips';
import PODCAST_HELP_SECTIONS from '@/components/help/podcastHelpSections';
import FOUNDRY_HELP_SECTIONS from '@/components/help/foundryHelpSections';
import VENUE_HELP_SECTIONS from '@/components/help/venueHelpSections';
import ENGINE_HELP_SECTIONS from '@/components/help/engineHelpSections';
import AUDIOTOOL_HELP_SECTIONS from '@/components/help/audiotoolHelpSections';

const SECTIONS = [
  {
    id: 'about',
    title: 'About BASE Station — who we are',
    icon: Radio,
    keywords: 'about team founder bryan payne spacial audio sam broadcaster history mission provenance webcasting radio',
    body: (
      <>
        <p>BASE Station is built by the team that helped independent creators through the last big technology shift. In the early 2000s, our founder <strong className="text-foreground">Bryan Payne</strong> (former CEO of Spacial Audio) along with then partner and CTO <strong className="text-foreground">Louis Louw</strong> launched <em>SAM Broadcaster</em> — software that democratized internet radio and gave thousands of webcasters the automated logging and reporting tools they needed to broadcast legally.</p>
        <p>Today, generative AI presents the same crossroads: enormous creative potential, met with blunt algorithmic bans from legacy platforms. Our answer is the same as it was then — don't ban the technology, bring <strong className="text-foreground">transparency and provenance</strong> to it. That's why every track here carries a Creative Ownership Score and a GenAI disclosure label.</p>
        <p><Link to="/about" className="text-amber-400 hover:underline">Read the full About page →</Link></p>
      </>
    ),
  },
  {
    id: 'ownership',
    title: 'Creative Ownership Score — get credit for YOUR creativity',
    icon: Fingerprint,
    keywords: 'ownership score cos ai assisted generated label riaa ifpi disclosure participation human tier co-creator collaborator curator',
    body: (
      <>
        <p>Every piece of content you generate gets a <strong className="text-foreground">0–100 Creative Ownership Score (COS)</strong> — a growing standard that measures how much of the creativity came from <em>you</em> versus the AI. It's aligned with the music community's voluntary GenAI labeling program (RIAA, IFPI &amp; partners, July 2026).</p>
        <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
          <p className="text-emerald-300 font-bold text-sm mb-1">💚 The more you put in, the more you own</p>
          <p>Here's the honest truth: if you let the AI decide everything, most of your content will carry the <strong className="text-foreground">AI-Generated</strong> label. But lean in — write your own lyrics, craft detailed prompts, upload references, build voice personas, iterate on your work — and your content earns the <strong className="text-foreground">AI-Assisted</strong> label (score 40+). That's your creative fingerprint, on the record.</p>
        </div>
        <p><strong className="text-foreground">Ways to raise your score (COS Engine 2.0):</strong></p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>+35</strong> — bring your own content (lyrics, script, copy)</li>
          <li><strong>+7 to +18</strong> — prompt depth, graded: basic (+7), detailed 100+ chars (+14), deep 200+ chars (+18)</li>
          <li><strong>+6</strong> — give real musical direction (BPM, key, song structure language)</li>
          <li><strong>+12</strong> — upload reference material (audio, image, document)</li>
          <li><strong>+9</strong> — use a saved voice persona or template</li>
          <li><strong>+6 to +10</strong> — pick custom genres, moods, and style tags; a rich palette earns more</li>
          <li><strong>+8</strong> — iterate: remix, extend, or refine prior work</li>
          <li><strong>+12</strong> — include a recorded human performance</li>
        </ul>
        <p>Engine 2.0 also maps every point onto <strong className="text-foreground">five creative dimensions</strong> — Content Authorship, Creative Direction, Sonic Identity, Vocal Identity, and Craft &amp; Refinement — so your manifest shows exactly which aspects of the work were human-directed, backed by a telemetry-confidence metric.</p>
        <p><strong className="text-foreground">Tiers:</strong> 🏆 Co-Creator (70–100) · 🎨 Collaborator (40–69) · 🤖 Curator (0–39)</p>
        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
          <p className="text-amber-300 font-bold text-sm mb-1">🔒 Provenance Manifest &amp; DDEX export</p>
          <p>Every scored asset also carries a <strong className="text-foreground">DDEX-style AI attribution profile</strong> — granular flags for lyrical content, composition, instrumentation, vocals, and post-production, each marked 🤖 Synthetic or 👤 Human. Open any item's <strong className="text-foreground">Provenance Manifest</strong> (the 🔒 button in your Ownership dashboard) to view the profile and hit <strong className="text-foreground">"Copy DDEX Tag Bundle"</strong> to export an XML metadata snippet you can hand to distributors or use to clear manual verification blocks.</p>
        </div>
        <p>Track your average score, tier breakdown, and creative evolution in <Link to="/creator-dashboard" className="text-purple-400 hover:underline">My Workspace → 🎖️ Ownership</Link>, or read the full <Link to="/creative-ownership" className="text-emerald-400 hover:underline">Creative Ownership onesheet →</Link></p>
      </>
    ),
  },
  {
    id: 'governance',
    title: 'Community Tuning Panel — govern the Living Standard',
    icon: Scale,
    keywords: 'governance community tuning panel proposals vote weights living standard transparency registry false flag dsp spotify block advocacy consensus ledger',
    body: (
      <>
        <p>The COS isn't a proprietary rulebook — it's a <strong className="text-foreground">living standard</strong>. No single entity should hold the monopoly on defining what counts as human creative effort, so the community benchmarks and tunes the scoring logic together.</p>
        <p><strong className="text-foreground">🗳️ COS Weight Proposals:</strong> when a new tool launches or an AI company adopts an ethically licensed training model, propose how it should be weighted (e.g. "Should a custom-trained local vocal model raise the Persona weight from +10 to +20?"). Creators vote, and adopted proposals join the public consensus ledger — the same ledger we can point to when a distributor questions how a hybrid track was scored.</p>
        <p><strong className="text-foreground">🛡️ Transparency Registry:</strong> if a DSP or distributor falsely flags your high-COS track despite a valid Provenance Manifest, log it in the registry. Aggregated evidence from thousands of indie artists turns BASE Station into a block-clearing advocacy network, not just a toolkit.</p>
        <p><Link to="/governance" className="text-amber-400 hover:underline">Open the Community Tuning Panel →</Link></p>
      </>
    ),
  },
  {
    id: 'music',
    title: 'Music Studio — generating tracks',
    icon: Music,
    keywords: 'music generate sonic tempolor mureka minimax lyria eleven music my sound coda harmonix siren song skye aurora base engines tab ai song track maestro track title',
    body: (
      <>
        <p>Music Studio has three primary tabs:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>⚡ Quick Generate</strong> — type a sound prompt, pick mood/genre, and we route to the best cloud model (Sonic, TemPolor, Mureka, MiniMax or Lyria). Turn on <strong>Maestro</strong> to have a songwriting agent craft the brief, enhance lyrics and recommend a model.</li>
          <li><strong>🎛️ Advanced</strong> — pick the model family and version yourself, set BPM, name the track, attach a voice persona and your own lyrics.</li>
          <li><strong>🏗️ BASE Engines</strong> — one tab holding all five of our in-house, self-hosted engines: <strong>🧬 CODA</strong>, <strong>🌊 Siren Song</strong>, <strong>🪶 Skye</strong>, <strong>🌅 Aurora</strong> and <strong>💡 Inspire</strong>. Pick an engine card and its full control panel opens below; see "BASE Engines" further down.</li>
        </ul>
        <p><strong className="text-foreground">Eleven Music &amp; My Sound now has its own page.</strong> It moved out of Music Studio and lives under <em>Enhance &amp; Edit</em> in the Studio Hub — <Link to="/eleven-music" className="text-cyan-400 hover:underline">open Eleven Music &amp; My Sound →</Link>. Train a fine-tune on your own tracks (with your consent) and generate in your signature style.</p>
        <p className="text-xs text-muted-foreground">ElevenLabs is not a default music generator — it stays in service for voice cloning, text-to-speech, and podcast voiceover. Stem separation no longer runs on Tempolor; see the Stems section.</p>
        <p><strong className="text-foreground">Sound prompt tips:</strong> describe instruments + atmosphere ("808 sub, brushed snare, distant choir, late-night intimate") — not just genre. 200–400 chars is the sweet spot.</p>
      </>
    ),
  },
  {
    id: 'lyrics',
    title: 'Lyrics Studio — writing lyrics',
    icon: Mic2,
    keywords: 'lyrics writing pro songwriter 243 masters engine mode rhyme scheme structure character limit length restriction',
    body: (
      <>
        <p>Pick a <strong className="text-foreground">topic</strong> (one concrete concept), 1–2 moods, and a style. Hit Generate.</p>
        <p><strong className="text-foreground">Three engine modes:</strong></p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Basic</strong> — fast lyrics from topic + mood + style (2 credits).</li>
          <li><strong>Pro Songwriter</strong> — Nashville/LA-grade rhyme craft. Add a reference writer and the lookup auto-fills mood, style, rhyme scheme &amp; BPM (2 credits).</li>
          <li><strong>243 Masters</strong> — full production report: lyrics plus chord progressions (Nashville numbers &amp; Roman numerals), arrangement notes, and a production brief (3 credits).</li>
        </ul>
        <p>Reference writers are used for <strong className="text-foreground">style only, never identity</strong> — see the "Style references &amp; legal disclosures" section below.</p>
        <p><strong className="text-foreground">Rhyme schemes:</strong> Mixed is the safest hit-song default. ABAB = pop alternating, AABB = couplets, XAXA = conversational/modern, AAAA = monorhyme tension.</p>
        <p><strong className="text-foreground">Structure templates</strong> give you proven section maps per genre (Standard Pop, Hip-Hop, Red Dirt Country, EDM Drop, Neo-Soul, etc.).</p>
        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
          <p className="text-amber-300 font-bold text-sm mb-1">⚠️ Character limits per music model</p>
          <p>Each downstream AI music generator enforces its own lyrics character cap. <strong className="text-foreground">If your lyrics exceed the limit, music generation will fail.</strong> Approximate caps:</p>
          <ul className="list-disc pl-5 space-y-0.5 mt-1.5">
            <li><strong>Sonic v5 / v4.5+</strong> — ~3,000 chars</li>
            <li><strong>TemPolor / Mureka / MiniMax / Lyria</strong> — ~2,500 chars</li>
            <li><strong>BASE Skye</strong> — ~6,000 chars · <strong>BASE CODA</strong> — ~4,000 chars</li>
            <li><strong>TemPolor i3 / i4</strong> — instrumental only (no lyrics)</li>
          </ul>
          <p className="mt-1.5">Pro Songwriter auto-clamps to the safest limit (defaults: Short 1.5k · Medium 2.5k · Long 4k · Full 5k). Keep verses concise; trim ad-libs if you hit the cap.</p>
        </div>
        <p>When done, hit <strong className="text-foreground">"Send to Music Studio →"</strong> — lyrics, genre and topic auto-fill the next step.</p>
        <p className="text-xs">Shortcuts: ⌘+Enter generate · ⌘+S save · ⌘+K shortcut panel.</p>
      </>
    ),
  },
  {
    id: 'legal',
    title: 'Style references & legal disclosures',
    icon: Scale,
    keywords: 'legal style reference artist name copyright disclosure disclaimer pro songwriter 243 masters identity voice likeness terms provenance',
    body: (
      <>
        <p>The Pro Songwriter and 243 Masters engines let you name a <strong className="text-foreground">reference writer or artist</strong>. Here's exactly what that does — and doesn't do:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Style, not identity</strong> — the name is converted into abstract craft descriptors only (rhyme scheme, tempo range, prosody, narrative tone, genre conventions). No lyrics, recordings, or voice of that artist are copied or simulated.</li>
          <li><strong>Why it's lawful</strong> — copyright protects specific expression, not styles, structures, or genres. The artist's name is never placed in your output, metadata, or credits.</li>
          <li><strong>Your responsibility</strong> — never market a song as being "by" or "in the voice of" a real artist, and carry your work's AI disclosure label through distribution.</li>
          <li><strong>Logged provenance</strong> — your structural choices (references, BPM, rhyme scheme) are recorded as human participation in the track's Provenance Manifest and raise your Creative Ownership Score.</li>
        </ul>
        <p>Full policies: <Link to="/transparency" className="text-amber-400 hover:underline">AI Transparency</Link> · <Link to="/terms" className="text-amber-400 hover:underline">Terms of Use</Link> · <Link to="/creative-ownership" className="text-emerald-400 hover:underline">Creative Ownership</Link></p>
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
    title: 'Video Studio — AI videos, music videos & timeline editor (beta-locked)',
    icon: Film,
    keywords: 'video ltx text image audio cinematic visualizer beta locked access request music video timeline editor upload library assets captions scenes shotstack own engine self-hosted hugging face 768 seed fallback',
    body: (
      <>
        <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/20 mb-2">
          <p className="text-orange-300 font-bold text-sm mb-1">🔒 Beta-locked feature</p>
          <p>Video Studio is currently in limited beta. Open it from the Studios hub and hit <strong className="text-foreground">Request Access</strong> — an admin will approve your request.</p>
        </div>
        <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 mb-2">
          <p className="text-emerald-300 font-bold text-sm mb-1">🎥 Our own video engine</p>
          <p>Text to Video renders on the <strong className="text-foreground">BASE Station LTX Engine</strong> first — our self-hosted model. It produces a fixed <strong className="text-foreground">768×512, ~4-second, silent</strong> clip from your prompt (same prompt + seed = same video). If our engine is asleep or busy, your request automatically falls back to the LTX cloud, where the model, resolution, duration, frame-rate and soundtrack controls apply. Image and Audio to Video always use the LTX cloud for now.</p>
        </div>
        <p><strong className="text-foreground">Five modes:</strong></p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Text to Video</strong> — describe the scene; our engine renders it for a flat 6 credits (LTX cloud as fallback, billed per second).</li>
          <li><strong>Image to Video</strong> — animate a reference still.</li>
          <li><strong>Audio to Video</strong> — a visual synced to your track.</li>
          <li><strong>Music Video</strong> — a storyboard of scenes stitched to your song, with transitions, title text and auto-captions.</li>
          <li><strong>Timeline Editor</strong> — a drag-and-drop editor: move clips, trim edges, layer audio and text, then render.</li>
        </ul>
        <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
          <p className="text-indigo-300 font-bold text-sm mb-1">📦 Assets can come from anywhere</p>
          <p>Every mode accepts material from three sources: <strong className="text-foreground">Upload</strong> (a file from your phone or computer), <strong className="text-foreground">My Library</strong> (anything you've already made here — tracks, masters, stems, SFX, visualizers, rendered videos, cover art), or an external <strong className="text-foreground">https URL</strong>.</p>
          <ul className="list-disc pl-5 space-y-1 mt-1.5">
            <li><strong>Image / Audio to Video</strong> — pick the reference from upload, library, or URL.</li>
            <li><strong>Music Video</strong> — each scene either searches free Pexels stock footage <em>or</em> uses your own clip/image; the soundtrack comes from an upload or your library.</li>
            <li><strong>Timeline Editor</strong> — the "Add to timeline" panel has Library / Upload / URL-and-Text tabs; audio always lands on its own track.</li>
          </ul>
        </div>
        <p><strong className="text-foreground">Aspect ratio matters:</strong> 9:16 for Reels/TikTok, 16:9 for YouTube, 1:1 for IG feed.</p>
        <p>Prompts should describe <strong className="text-foreground">motion, lighting, and atmosphere</strong>, not just objects. "Slow zoom through neon city rain at 3 AM" beats "city at night".</p>
        <p>Duration: 5s for quick tests, 10–15s for proper visualizers. Render time ≈ 12s per second of video.</p>
        <p><strong className="text-foreground">Costs:</strong> LTX generation ≈ 2 credits per second. Music Video &amp; Timeline renders are 5 credits base + 1 per scene/clip, +3 if a soundtrack is attached, +4 for auto-captions.</p>
        <p>Using your own footage, images and audio also <strong className="text-foreground">raises your Creative Ownership Score</strong> — uploaded reference material counts as human participation.</p>
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
        <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/20">
          <p className="text-purple-300 font-bold text-sm mb-1">🎛️ Patch Modulation — visuals that follow the processing</p>
          <p>In step 3 you can tap a <strong className="text-foreground">BASE Foundry patch</strong> as a modulation source. Any patch of yours containing an LFO or an envelope shows up in the list; switch on "Drive visuals" and the picture's scale, saturation and brightness move with that modulator instead of only with loudness. Live meters show each modulator's value as it runs.</p>
          <p className="mt-1.5">The patch runs <strong className="text-foreground">silently</strong> — it is read as a control source only and never touches, colours or re-renders your audio.</p>
        </div>
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
          <li>Music (cloud models): 10 credits per track</li>
          <li>BASE Engines — Siren Song: 12 · Skye: 14 · Inspire: 13 · Aurora: shown on the button · CODA: priced by tier (Micro / Pro / Vault) · CODA edit tasks (cover / repaint / extract): 10</li>
          <li>Cover art: 1 (Cheap) / 3 (Modest)</li>
          <li>Video — Text to Video on our own engine: 6 credits flat · LTX cloud: 1–7 credits per second depending on model and resolution</li>
          <li>Music Video / Timeline render: 5 base + 1 per scene or clip (+3 audio, +4 captions)</li>
          <li>Visualizer: 12 credits</li>
          <li>Stem separation: 2 credits (Sever) · free on-device</li>
          <li>BASE Foundry: free — patches, presets, collections and the visualizer modulation tap all run in your browser</li>
        </ul>
        <div className="p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
          <p className="text-yellow-300 font-bold text-sm mb-1">⚡ Open beta credits</p>
          <p>Every new account starts with a <strong className="text-foreground">250-credit welcome bonus</strong>. During the beta, additional credits are allotted by the BASE Station team — credit purchases (Stripe) arrive after the beta. Need a top-up? Ask in the <Link to="/forum" className="text-amber-400 hover:underline">community forum</Link>.</p>
        </div>
        <p>Check your balance in the header, and view your full transaction history on the <Link to="/credits" className="text-purple-400 hover:underline">Credits page →</Link></p>
      </>
    ),
  },
  {
    id: 'registration',
    title: 'On-chain registration — prove your ownership, free',
    icon: Shield,
    keywords: 'blockchain base register registration provenance ipfs anchor fingerprint certificate basescan gas wallet crypto free on-chain proof',
    body: (
      <>
        <p>One click permanently anchors your track's provenance on the <strong className="text-foreground">Base blockchain</strong> — no wallet, no crypto, no gas fees. Base Station's platform wallet signs and pays for every registration.</p>
        <p><strong className="text-foreground">What happens when you hit Register:</strong></p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Manifest built</strong> — your Creative Ownership Score, DDEX AI-attribution flags, and track metadata are compiled and fingerprinted (SHA-256).</li>
          <li><strong>Pinned to IPFS</strong> — the manifest gets a permanent, content-addressed home anyone can verify.</li>
          <li><strong>Anchored on Base</strong> — the fingerprint and IPFS link are written to the blockchain in ~20 seconds.</li>
          <li><strong>Certificate issued</strong> — download it, view the record on BaseScan, and export DDEX/ID3 metadata for distributors.</li>
        </ul>
        <p>Because it starts at creation — every prompt, reference upload, and iteration is logged as human participation — your registration proves not just <em>that</em> you made the track, but <em>how much of it</em> was yours.</p>
        <p>See all your records and certificates in <Link to="/creator-dashboard?tab=proof" className="text-blue-400 hover:underline">My Workspace → 🛡️ Proof of Ownership</Link></p>
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
          <li><strong>Publish to Audius</strong> — push to the Audius decentralized network from any finished asset, or straight from an Audiotool export (see the Audiotool and Audius sections below).</li>
          <li><strong>Live Studio</strong> <span className="text-orange-300 font-semibold">(beta-locked — request access)</span> — go live with a co-listening session for your fans, with reactions, chat, tipping, and collectible drops.</li>
          <li><strong>3D Venues</strong> — open a permanent room that plays your music around the clock, with AI staff and a public stage page. See the venue sections below.</li>
        </ul>
      </>
    ),
  },
  // ORVO podcast module — content lives in its own file to keep this list legible
  ...PODCAST_HELP_SECTIONS,
  {
    id: 'audio-tools',
    title: 'Audio tool studios — stems, mashups, harmonies & more',
    icon: Layers,
    keywords: 'stems stem creator mashup vocal harmonizer cover song sfx sound effects audio remix extract split',
    body: (
      <>
        <p>Beyond generation, a full rack of audio tools works on any track in your library or uploaded from your PC:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Stem Creator</strong> — six-stem separation (vocals, drums, bass, guitar, piano, other) on our Sever engine for 2 credits, or free on-device in your browser. Each stem lands in your library as its own playable asset. See the Stems section for details.</li>
          <li><strong>Mashup Studio</strong> — blend two tracks into a new hybrid arrangement.</li>
          <li><strong>Vocal Harmonizer</strong> — layer AI-generated harmonies onto an existing vocal.</li>
          <li><strong>Cover Song Studio</strong> — reimagine a track in a new genre or style using reference-based generation, with preset transformations.</li>
          <li><strong>Audio Remix Studio</strong> — edit, extend, and apply effects to existing audio, plus Coda edit tasks: <strong>Cover</strong> (re-render a track in a new style), <strong>Repaint</strong> (regenerate just a time range) and <strong>Extract</strong> (pull a part out) — 10 credits each.</li>
          <li><strong>Sound FX Studio</strong> — generate custom sound effects from text descriptions.</li>
          <li><strong>Promo Studio</strong> — build shareable promo packages and social cards for a release.</li>
        </ul>
        <p>Every derived asset keeps its <strong className="text-foreground">provenance chain</strong> — stems, mashups, and masters all link back to their source track and inherit the correct AI disclosure label. Find them all in <Link to="/studios" className="text-purple-400 hover:underline">Studios →</Link></p>
      </>
    ),
  },
  // Self-hosted engines, lead sheet workflow, stems & loops
  ...ENGINE_HELP_SECTIONS,
  // BASE Foundry — DSP tool module, content in its own file
  ...FOUNDRY_HELP_SECTIONS,
  // Audiotool Bridge + Audius distribution
  ...AUDIOTOOL_HELP_SECTIONS,
  // 3D venues, idle programming and AI staff
  ...VENUE_HELP_SECTIONS,
  {
    id: 'rights',
    title: 'Rights Management Portal — your catalog, verified',
    icon: FileCheck,
    keywords: 'rights portal catalog ddex export manifest verification ownership id3 tags metadata distributor',
    body: (
      <>
        <p>The <Link to="/rights" className="text-emerald-400 hover:underline">Rights Portal</Link> gives you a single view of your entire audio catalog with per-track rights tooling:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Ownership scores</strong> — COS and AI disclosure label for every track at a glance.</li>
          <li><strong>Verification status</strong> — BASE Mark watermark and on-chain hash-anchor state per track.</li>
          <li><strong>DDEX export</strong> — copy a distributor-ready XML metadata bundle for any track.</li>
          <li><strong>Provenance manifests</strong> — open the full attribution manifest for any asset.</li>
          <li><strong>False-flag reporting</strong> — log downstream DSP flags straight into the Transparency Registry.</li>
        </ul>
        <p>Also see the <Link to="/id3-studio" className="text-amber-400 hover:underline">ID3 Tag Studio</Link> to write compliant metadata (including AI disclosure tags) directly into your audio files before distribution.</p>
      </>
    ),
  },
  {
    id: 'basemark',
    title: 'BASE Mark — acoustic watermark & public verification',
    icon: ScanLine,
    keywords: 'base mark watermark acoustic verify scanner detect provenance forensic embed audio',
    body: (
      <>
        <p><strong className="text-foreground">BASE Mark</strong> is an inaudible acoustic watermark embedded directly into your audio waveform — it survives re-encoding and identifies your track even when metadata is stripped.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Automatic</strong> — every new WAV audio asset saved to your library is marked automatically.</li>
          <li><strong>Manual</strong> — embed or detect marks on any file in the <Link to="/base-mark" className="text-amber-400 hover:underline">BASE Mark Studio</Link>.</li>
          <li><strong>Public verification</strong> — anyone (no account needed) can scan a file at <Link to="/verify" className="text-emerald-400 hover:underline">/verify</Link> to confirm it's a registered BASE Station track.</li>
        </ul>
        <p>BASE Mark is one layer of the three-tier provenance stack: acoustic watermark → ID3/DDEX metadata → on-chain registration.</p>
      </>
    ),
  },
  {
    id: 'community',
    title: 'Community — charts, radio, challenges & forum',
    icon: Users,
    keywords: 'community charts radio challenges leaderboard badges forum threads discover playlists featured artists audius',
    body: (
      <>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong><Link to="/charts" className="text-purple-400 hover:underline">Charts</Link></strong> — weekly, monthly, and all-time rankings of community tracks. Plays and votes move the needle.</li>
          <li><strong><Link to="/radio" className="text-purple-400 hover:underline">Radio</Link></strong> — 24/7 genre channels (plus an AI-only channel) mixing approved community submissions, protected BASE Station exports and Audius catalog tracks. The Now Playing card and player bar have <strong>Artist</strong>, <strong>Like</strong> and <strong>Tip</strong> buttons for Audius tracks. Admins can bulk-import creators' library tracks into rotation. <span className="text-xs text-muted-foreground">Audius streams don't allow live audio analysis, so the VU meters show a simulated signal for those tracks.</span></li>
          <li><strong><Link to="/challenges" className="text-purple-400 hover:underline">Challenges</Link></strong> — themed competitions with badge rewards, in two categories: <strong>Music</strong> (a track is the entry) and <strong>Patch Design</strong> (a BASE Foundry patch is the entry, judged on the graph you designed rather than on audio). Forked entries are allowed and shown with their lineage — credit is displayed, not hidden.</li>
          <li><strong><Link to="/leaderboard" className="text-purple-400 hover:underline">Leaderboard &amp; Badges</Link></strong> — earn XP and badges for creating, submitting, and supporting other artists.</li>
          <li><strong><Link to="/forum" className="text-purple-400 hover:underline">Community Forum</Link></strong> — open to everyone (no account required) with dedicated boards for legal &amp; terms, COS methodology, and AI music policy.</li>
          <li><strong><Link to="/news-hub" className="text-purple-400 hover:underline">News Hub</Link></strong> — auto-curated AI music legal, policy, and industry news, refreshed 3× daily.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'fans',
    title: 'Fan economy — clubs, collectibles & tipping',
    icon: Heart,
    keywords: 'fans fan hub club membership collectibles tips tipping follow artists store xp',
    body: (
      <>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Fan Hub</strong> — follow artists, track your memberships and collectibles in <Link to="/fan-hub" className="text-pink-400 hover:underline">Fan Hub</Link>.</li>
          <li><strong>Fan Clubs</strong> — creators can launch tiered fan clubs; fans join for exclusive access.</li>
          <li><strong>Collectibles</strong> — creators mint limited-edition drops that fans claim; syncs with Audius.</li>
          <li><strong>Tipping</strong> — support artists directly from their profile, Audius pages, Radio or live sessions. Tips are <strong className="text-foreground">non-custodial</strong>: ETH on Base or SOL on Solana go wallet-to-wallet, $AUDIO goes straight to the artist's Audius wallet, and card tips run through Stripe. BASE Station never holds the funds, and crypto tips are only recorded after they're verified on-chain.</li>
        </ul>
        <p>Artists: add your receiving addresses (Base, Solana, Audius handle) under <Link to="/my-profile" className="text-pink-400 hover:underline">My Profile → Tip wallets</Link> to switch each rail on.</p>
        <p>Creators manage all of this from <Link to="/creator-dashboard" className="text-purple-400 hover:underline">My Workspace</Link>.</p>
      </>
    ),
  },
  {
    id: 'beta',
    title: 'Beta-locked features — Live Studio & Video Studio',
    icon: Lock,
    keywords: 'beta locked access request live studio video studio approval gate limited',
    body: (
      <>
        <p>BASE Station is in <strong className="text-foreground">open beta</strong>. Two features remain gated while we scale them:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Live Studio</strong> — live co-listening sessions with chat, reactions, quests, and drops.</li>
          <li><strong>Video Studio</strong> — AI video generation (text, image, audio), multi-scene music videos, and the drag-and-drop timeline editor.</li>
        </ul>
        <p>Opening either page shows a <strong className="text-foreground">Request Access</strong> screen — submit it once and an admin will review your request. Everything else on the platform is fully open.</p>
      </>
    ),
  },
  {
    id: 'more-tools',
    title: 'More tools — Scribe & SUB-Station',
    icon: Cpu,
    keywords: 'scribe melody extraction transcription score sub-station multitrack workstation',
    body: (
      <ul className="list-disc pl-5 space-y-1">
        <li><strong><Link to="/scribe-studio" className="text-amber-400 hover:underline">Scribe Studio</Link></strong> — transcribe a track into a score (melody, chords, key). Melody extraction works best on clean vocals; busy mixes can leak accompaniment into the result.</li>
        <li><strong><Link to="/sub-station" className="text-amber-400 hover:underline">SUB-Station</Link></strong> — multi-track arrangement workstation for combining, arranging and mixing down your assets. <Link to="/sub-station/help" className="text-amber-400 hover:underline">SUB-Station help →</Link></li>
      </ul>
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