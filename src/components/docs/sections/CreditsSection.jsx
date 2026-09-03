import { Heart, Cpu, Shield, Scale } from 'lucide-react';

const Group = ({ title, items }) => (
  <div className="rounded-2xl border border-border bg-card p-5">
    <h3 className="font-display text-base text-foreground mb-3">{title}</h3>
    <ul className="space-y-2.5 text-sm text-muted-foreground">
      {items.map((i) => (
        <li key={i.name}>
          <span className="text-foreground font-semibold">{i.name}</span>
          {i.by && <span className="text-muted-foreground/80"> (by {i.by})</span>} — {i.role}
        </li>
      ))}
    </ul>
  </div>
);

export default function CreditsSection() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Heart className="w-5 h-5 text-[#FF9A4D]" />
          <h1 className="font-display text-2xl md:text-3xl text-foreground">Credits &amp; Technology Partners</h1>
        </div>
        <p className="text-muted-foreground leading-relaxed">
          BASE Station is a creator-owned AI music platform built on our own provenance technology and a
          curated stack of best-in-class third-party engines. For transparency, here is who does what —
          and where the line sits between our technology and our partners'.
        </p>
      </div>

      {/* Our own tech */}
      <div className="rounded-2xl border border-[#FF9A4D]/30 bg-[#FF9A4D]/[0.04] p-5">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-[#FF9A4D]" />
          <h2 className="font-display text-lg text-foreground">Built by BASE Station</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          These are our systems — designed, built, benchmarked and operated in-house. They are what makes a
          BASE Station track different from a file that merely came out of a model.
        </p>
        <ul className="space-y-3 text-sm text-muted-foreground">
          <li>
            <span className="text-foreground font-semibold">BASE Mark</span> — our forensic audio watermarking
            cascade. Inaudible provenance markers are embedded into your master and survive real-world handling:
            re-encoding, streaming, clipping, EQ, resampling and partial re-uploads. Verification runs as a
            cheapest-first cascade so most checks are near-instant, escalating to deeper scanning only when a
            track needs it. Anyone can verify a file in the public{' '}
            <span className="text-foreground">Verify</span> tool — no account required. Our marking method,
            payload structure and detection thresholds are proprietary and deliberately undocumented; BASE Mark
            functions as a technological protection measure, and publishing its internals would help the exact
            people it exists to stop. Detection performance is continuously adversarially benchmarked, and we
            publish honest capability and limitation notes rather than marketing numbers.
          </li>
          <li>
            <span className="text-foreground font-semibold">Creative Ownership Score (COS)</span> — our
            human-participation engine. As you work, BASE Station records the creative decisions you actually
            made — your writing, your uploads, your edits, your takes, your mixing choices — and scores your
            participation in the finished recording. COS is what produces an honest, industry-standard AI
            disclosure label (RIAA/IFPI GenAI track-level standard, 2026):{' '}
            <span className="text-foreground">AI-generated</span>,{' '}
            <span className="text-foreground">AI-assisted</span> or <span className="text-foreground">human</span>.
            Labels are earned from telemetry, never self-declared marketing.
          </li>
          <li>
            <span className="text-foreground font-semibold">Provenance Manifest &amp; Rights Portal</span> — a
            machine-readable record of how a track was made: engines involved, prompts and references you
            supplied, COS signals, BASE Mark status and rights metadata — exportable for delivery and dispute
            handling.
          </li>
          <li>
            <span className="text-foreground font-semibold">On-chain provenance anchoring</span> — a tamper-evident
            timestamp of your provenance bundle, anchored on Base (Solana support planned), so ownership claims
            have an independent, third-party-verifiable record.
          </li>
          <li>
            <span className="text-foreground font-semibold">Industry-standard delivery</span> — DDEX export and
            ID3v2 tagging that carry your AI disclosure, credits and provenance references into the same fields
            labels, DSPs and PROs already read.
          </li>
          <li>
            <span className="text-foreground font-semibold">The BASE Station studio suite</span> — Music, Lyrics,
            Loop, Stem, Mashup, Mastering, Cover Song, Cover Art, SFX, Visualizer, Video and ORVO podcast
            studios, plus Live Studio, quests, charts and the creator workspace. The orchestration, routing,
            mastering chain, forensic pipeline and creator economy around the engines below are ours.
          </li>
        </ul>
      </div>

      {/* Partners */}
      <div className="flex items-center gap-2 pt-2">
        <Cpu className="w-4 h-4 text-[#FFC98A]" />
        <h2 className="font-display text-lg text-foreground">Technology partners</h2>
      </div>
      <p className="text-sm text-muted-foreground -mt-3">
        We surface each partner's strengths so you can pick the right engine for the job, and we disclose their
        involvement honestly. Availability and model versions change as providers ship updates.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <Group
          title="Music & audio generation"
          items={[
            { name: 'BASE CODA', role: 'our in-house BASE Station engine, originally forked from the open ACE-Step research model' },
            { name: 'BASE Forge', role: 'our open-model instrumental & loop configuration for DAW-ready, PCM-clean output' },
            { name: 'TemPolor', role: 'multi-language vocal and instrumental models' },
            { name: 'ElevenLabs', role: 'sound effects, voice synthesis and personal voice models' },
            { name: 'Sonic', role: 'voice cloning and audio analysis' },
          ]}
        />
        <Group
          title="Video generation & assembly"
          items={[
            { name: 'LTX Video', by: 'Lightricks', role: 'AI video generation behind our text-, image- and audio-to-video modes' },
            { name: 'Shotstack', role: 'cloud video assembly, the drag-and-drop Timeline Editor, and cloud rendering' },
            { name: 'Pexels', role: 'free stock footage for music-video scenes (attribution surfaced on every render that uses it)' },
          ]}
        />
        <Group
          title="Voice, speech & intelligence"
          items={[
            { name: 'Inworld AI', role: 'podcast scripting and expressive voicing in ORVO Studio' },
            { name: 'AssemblyAI', role: 'transcription, chapters and episode intelligence' },
            { name: 'OpenAI Whisper', role: 'speech-to-text transcription' },
          ]}
        />
        <Group
          title="Distribution, storage & chain"
          items={[
            { name: 'Audius', role: 'decentralised streaming, publishing and collectibles' },
            { name: 'Pinata / IPFS', role: 'content-addressed storage for masters, artwork and provenance bundles' },
            { name: 'Base', by: 'Coinbase', role: 'L2 network for provenance anchoring' },
            { name: 'Streamr', role: 'real-time audio transport for Live Studio' },
            { name: 'Replicate', role: 'GPU model hosting for our own and open models' },
            { name: 'Freesound', role: 'CC-licensed reference material for forensic benchmarking' },
          ]}
        />
      </div>

      {/* Licensing */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Scale className="w-4 h-4 text-[#FFC98A]" />
          <h2 className="font-display text-lg text-foreground">Licensing &amp; attribution obligations</h2>
        </div>
        <ul className="space-y-2.5 text-sm text-muted-foreground">
          <li>
            <span className="text-foreground font-semibold">Open-source models</span> — the BASE Engines and BASE Forge
            are BASE Station configurations of permissively licensed open research models (Apache-2.0 family). We
            comply with their licence and attribution terms and do not train them on other commercial providers'
            outputs.
          </li>
          <li>
            <span className="text-foreground font-semibold">Open-source software</span> — the app is built on
            React, Tailwind CSS, Vite, shadcn/ui, Radix UI, lucide-react, Recharts, Three.js and other
            permissively licensed libraries; MilkDrop-style visuals are powered by Butterchurn. Copyright and
            licence notices ship with our distributed builds.
          </li>
          <li>
            <span className="text-foreground font-semibold">Stock media</span> — Pexels clips carry the
            attribution Pexels requires, generated and stored with every render that uses them.
          </li>
          <li>
            <span className="text-foreground font-semibold">Provider terms</span> — each partner engine is used
            under its own commercial terms. Your rights in the output follow both those terms and ours, and your
            provenance manifest records which engine touched which part of the work.
          </li>
          <li>
            <span className="text-foreground font-semibold">Your material, your call</span> — generation data is
            only used to improve our models with your explicit opt-in, and audio content is kept isolated from
            training by default to protect your provenance position.
          </li>
          <li>
            <span className="text-foreground font-semibold">Trademarks</span> — BASE Mark, Creative Ownership
            Score, the BASE Engines (CODA, Siren Song, Skye), BASE Forge, ORVO Studio and BASE Station are ours. All other names above belong to
            their respective owners and appear here for identification and disclosure only.
          </li>
        </ul>
      </div>

      <div className="rounded-2xl border border-border bg-secondary/40 p-5 text-sm text-muted-foreground leading-relaxed">
        <span className="text-foreground font-semibold">A note on authorship.</span> Lyrics, arrangement and
        production decisions are made <em>with you</em> inside BASE Station; audio is then rendered by the engines
        above, marked with BASE Mark, scored by COS and recorded in your provenance manifest. That is the whole
        point: a track that can prove where it came from and how much of it is yours. BASE Station curates,
        orchestrates and protects — the credit for the creative work stays with the creator.
      </div>
    </div>
  );
}