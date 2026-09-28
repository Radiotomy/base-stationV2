import { Link } from 'react-router-dom';
import { Cpu, Music4, Layers3 } from 'lucide-react';

// Help entries for BASE Station's self-hosted engines and the lead-sheet
// workflow. Kept out of Help.jsx so the main list stays legible.
const ENGINE_HELP_SECTIONS = [
  {
    id: 'engines',
    title: 'BASE Engines — CODA, Siren Song, Skye, Aurora & Inspire',
    icon: Cpu,
    keywords: 'base engines tab coda harmonix siren song skye aurora inspire continuation minimax music3 in-house self-hosted fork seed instrumental lyrics long-form engine cards',
    body: (
      <>
        <p>The <strong className="text-foreground">🏗️ BASE Engines</strong> tab in <Link to="/music-studio" className="text-purple-400 hover:underline">Music Studio</Link> holds all five of our own engines in one place — pick an engine card at the top and its full control panel opens below. Each engine was originally forked from an open-source base and is then developed, tuned and maintained by our team on our own self-hosted infrastructure. Your prompts and audio never train a third-party provider, and every render is saved to your library as a WAV, BASE Marked automatically and given cover art.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>🧬 BASE CODA</strong> — fast and tag-driven: describe genre, instruments and mood as comma tags; add BPM, key and time signature for a tighter groove. Lyrics use lowercase <code>[verse]</code> / <code>[chorus]</code> section tags (the studio converts them for you). CODA also powers the <strong>Cover / Repaint / Extract</strong> edit tasks in Audio Remix Studio.</li>
          <li><strong>🌊 BASE Siren Song</strong> — tag + lyric conditioned, up to 6 minutes, 12 credits. Leave lyrics empty for a pure instrumental.</li>
          <li><strong>🪶 BASE Skye</strong> — steered with a <em>prose</em> description of the production (full sentences, not tags). Long-form output from 95 s to 210 s, 14 credits. Best for full song structures; write lyrics with <code>[verse]</code> / <code>[chorus]</code> / <code>[bridge]</code> markers or leave them empty for an instrumental.</li>
          <li><strong>🌅 BASE Aurora</strong> — our self-hosted deployment of the open-weight <strong className="text-foreground">MiniMax-Music3</strong> model (attribution required by its community licence, and shown in the studio). Steered with a structured caption or a prose paragraph, renders complete songs up to 5 minutes, and outputs native 32 kHz 16-bit stereo — the only prompt-generated path that is lossless at source.</li>
          <li><strong>💡 BASE Inspire</strong> — instrumental sketches up to 5 minutes, and the only engine that can continue one of your own tracks. Short prompts are expanded into a detailed caption automatically. Output is mono with a soft top end, so use Sonic or Aurora for finished releases. 13 credits.</li>
        </ul>
        <p><strong className="text-foreground">Seeds:</strong> every engine accepts a seed — same prompt + same seed reproduces the same track, so you can iterate on wording without losing a take you liked.</p>
        <p className="text-xs text-muted-foreground">These engines run one job at a time each. A busy engine means a longer wait, never a failure; if one is waking from sleep the first request can take a couple of minutes to be accepted. Credits are only charged when a render completes.</p>
      </>
    ),
  },
  {
    id: 'leadsheet',
    title: 'Lead Sheet Studio — Cantor vocals, Cadence beds & SUB-Station',
    icon: Music4,
    keywords: 'lead sheet chord chart melody score cantor diffsinger cadence musicgen chord bed voicebank sub-station arrangement multitrack ai assisted authored',
    body: (
      <>
        <p>The <Link to="/lead-sheet-studio" className="text-amber-400 hover:underline">Lead Sheet Studio</Link> is for writers who compose rather than prompt. You enter a key, BPM, chord chart, lyrics and a syllable-by-syllable melody — then render it.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Cantor</strong> sings <em>exactly</em> the notes you wrote using a DiffSinger voicebank. Because the melody is authored, the vocal is labelled <strong>AI-Assisted</strong> by construction, not by inference.</li>
          <li><strong>Cadence</strong> renders an instrumental bed that plays your literal chord progression (one chord per bar, commas subdivide a bar). Describe instrumentation only in the prompt — the harmony comes from your chart. Up to 120 s.</li>
          <li><strong><Link to="/sub-station" className="text-amber-400 hover:underline">SUB-Station</Link></strong> is the multi-track workstation where the Cantor vocal and Cadence bed are combined, arranged and mixed down. Vocal and bed stay separate assets so their provenance never collapses into one claim.</li>
        </ul>
        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
          <p className="text-amber-300 font-bold text-sm mb-1">Current limits</p>
          <p>Cantor voicebanks are being installed — until a bank shows as renderable in the studio, vocal renders will be unavailable. Cadence beds are for testing and personal use for now while licensing of the underlying model is finalized.</p>
        </div>
        <p>Every score is hashed server-side, so a track rendered from it can point at your authored score as its provenance source when you register it on-chain.</p>
      </>
    ),
  },
  {
    id: 'stems-loops',
    title: 'Stems (Sever & on-device) and semantic loop search',
    icon: Layers3,
    keywords: 'stems sever htdemucs six stems guitar piano on-device browser local free clap semantic search sounds like loops soundforge',
    body: (
      <>
        <p><Link to="/stem-creator" className="text-emerald-400 hover:underline">Stem Creator</Link> splits any track into <strong className="text-foreground">six stems</strong> — vocals, drums, bass, guitar, piano, other — two ways:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Sever</strong> — our hosted HTDemucs engine. 2 credits, charged only on success; usually a minute or two, one track at a time.</li>
          <li><strong>On-device</strong> — the same model runs inside your browser. Free, and your audio never leaves your machine; it is slower and works best on a laptop or desktop.</li>
        </ul>
        <p>Stems inherit the source track's AI label and link back to it in your library.</p>
        <p><strong className="text-foreground"><Link to="/loop-studio" className="text-emerald-400 hover:underline">Loop Studio</Link>:</strong> generated loops are finished (trimmed to the bar, normalized, seamless) and registered for provenance. The <em>Sounds like…</em> search finds loops by what they sound like rather than their tags — it is a similarity tool only and says nothing about who owns a sound.</p>
      </>
    ),
  },
];

export default ENGINE_HELP_SECTIONS;