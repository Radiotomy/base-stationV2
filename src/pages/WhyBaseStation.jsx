import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Shield, Users, Zap, Lock, Heart, Sparkles, ShieldCheck, Bot, Fingerprint, FileText, ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import AILabelBadge from '@/components/common/AILabelBadge';

export default function WhyBaseStation() {
  const features = [
    {
      icon: Shield,
      title: 'Immutable Ownership',
      desc: 'Your music—whether human-created, AI-assisted, or fully AI-generated—is registered on-chain with permanent, verifiable provenance. No one can dispute your authorship.',
      accent: '#60a5fa',
    },
    {
      icon: Users,
      title: 'All Creators Welcome',
      desc: 'Base Station celebrates every creative process. Human composers, AI-hybrid artists, producers using AI tools—all are equally valued and supported.',
      accent: '#FFC98A',
    },
    {
      icon: Zap,
      title: 'AI-Human Hybrid Tools',
      desc: 'Leverage cutting-edge AI across lyrics, music generation, cover art, and video—designed to amplify your creativity, not replace your skill.',
      accent: '#fbbf24',
    },
    {
      icon: Lock,
      title: 'Creator Control',
      desc: 'You retain full ownership and control over your creations. Export to cloud storage, distribute globally, or keep work private—entirely your choice.',
      accent: '#c4b5fd',
    },
    {
      icon: Heart,
      title: 'Community Support',
      desc: 'Build your fanbase, receive tips, earn from plays, and collaborate with a global community that genuinely values your work.',
      accent: '#fb7185',
    },
    {
      icon: Sparkles,
      title: 'Creative Ownership Score',
      desc: 'Every track gets a transparent score reflecting how much human input shaped it—giving credit where it’s due, no matter how the music was made.',
      accent: '#34d399',
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 inset-x-0 z-40 bg-background/85 backdrop-blur-xl border-b border-border/50 px-6 h-14 flex items-center">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-semibold">Back</span>
        </Link>
      </div>

      {/* Hero — obsidian glass, no clashing gradient */}
      <div className="overflow-hidden pt-16 pb-16 px-6">
        <div className="relative max-w-5xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Badge className="mb-4 border-[#FF9A4D]/30 bg-[#FF9A4D]/10 text-[#FFC98A] px-4 py-1.5 text-xs tracking-widest uppercase font-semibold">
              Our Mission
            </Badge>
            <h1 className="text-4xl md:text-6xl font-black text-foreground mb-6 tracking-tight leading-tight">
              Why Base Station<br />
              <span className="text-iridescent">for All Creators</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-3xl mx-auto leading-relaxed">
              Base Station is built on a core belief: <span className="text-foreground font-semibold">all music creation matters</span>. Whether you're a classical composer, bedroom producer, AI experimenter, or hybrid artist, we're here to empower your unique creative voice with secure ownership, advanced tools, and a welcoming global community.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Core Values — dark merc cards, high-contrast text */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-black text-foreground mb-4">What Sets Base Station Apart</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">Six core reasons why creators choose Base Station.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="merc-card merc-card-hover p-6 rounded-2xl transition-all group"
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `${feature.accent}1a`, border: `1px solid ${feature.accent}40`, color: feature.accent }}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-black text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Inclusive Creator Philosophy — dark cards on subtle band */}
      <div className="border-y border-border/50 px-6 py-16 bg-card/30">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-foreground mb-4">Human + AI = Infinite Possibilities</h2>
            <p className="text-muted-foreground text-lg">
              We don't believe in gatekeeping or hierarchies. Every creator deserves recognition and support.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {[
              {
                emoji: '🎹',
                label: 'Traditional Creators',
                desc: 'Use Base Station to compose, record, and protect your traditional musical creations on-chain. Reach global audiences instantly.',
              },
              {
                emoji: '🤖',
                label: 'AI Enthusiasts',
                desc: 'Explore unlimited possibilities with cutting-edge AI music, lyrics, and video generation. Your AI-generated art deserves immutable ownership.',
              },
              {
                emoji: '⚡',
                label: 'Hybrid Artists',
                desc: 'Blend human creativity with AI tools. Base Station was designed for artists who use both—leveraging AI to amplify their unique vision.',
              },
            ].map((group, i) => (
              <motion.div
                key={group.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="merc-card p-6 rounded-xl text-center"
              >
                <p className="text-3xl mb-3">{group.emoji}</p>
                <p className="font-bold text-foreground mb-2">{group.label}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{group.desc}</p>
              </motion.div>
            ))}
          </div>

          <div className="merc-card rounded-2xl p-8 text-center">
            <p className="text-lg font-bold text-foreground mb-3">Base Station's Mission</p>
            <p className="text-muted-foreground leading-relaxed mb-6">
              To create a thriving ecosystem where <span className="text-foreground font-semibold">all creators feel valued</span>, regardless of their process or tools. We believe that innovation happens at the intersection of human creativity and technological possibility. Our platform is built to celebrate diversity, protect ownership, and empower every artist to share their voice with the world.
            </p>
            <Badge className="border-[#FF9A4D]/30 bg-[#FF9A4D]/10 text-[#FFC98A]">Human + AI on Chain</Badge>
          </div>
        </div>
      </div>

      {/* AI vs Human Transparency — the 3 labels */}
      <div className="border-y border-border/50 px-6 py-16 bg-card/30">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FF9A4D]/30 bg-[#FF9A4D]/10 px-4 py-1.5 text-[10px] font-bold tracking-widest uppercase text-[#FFC98A] mb-4">
              <ShieldCheck className="w-3.5 h-3.5" /> GenAI Labeling Program · July 2026
            </div>
            <h2 className="text-3xl font-black text-foreground mb-4">Transparency for AI vs. Human Content</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Every sound recording is labeled in line with the music-community GenAI labeling program (IFPI, RIAA, A2IM, WIN, IMPALA, The Grammys, SAG-AFTRA &amp; the Human Artistry Campaign). No guesswork — the provenance is right there on the track.
            </p>
          </div>

          <div className="space-y-4">
            {[
              { value: 'ai_generated', title: 'AI-Generated', desc: 'Generative AI created the entirety or primary portion of the sound recording — an AI lead vocal, a key AI instrumental performance, or fully prompt-generated music.' },
              { value: 'ai_assisted', title: 'AI-Assisted', desc: 'The recording is substantially human and expresses human creativity, but generative AI was used for some expressive elements. Humans performed the lead vocal and primary instruments.' },
              { value: 'human', title: 'Human', desc: 'No generative AI was used in the sound recording.' },
            ].map((l) => (
              <div key={l.value} className="merc-card rounded-xl p-5 flex items-start gap-4">
                {l.value === 'human' ? (
                  <span className="w-10 h-10 rounded-lg border-2 border-dashed border-muted-foreground/40 flex-shrink-0" />
                ) : (
                  <AILabelBadge label={l.value} size="md" className="flex-shrink-0" />
                )}
                <div>
                  <p className="font-bold text-foreground mb-1">{l.title}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{l.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="merc-card rounded-2xl p-6 mt-6 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#34d3991a', border: '1px solid #34d39940', color: '#34d399' }}>
              <FileText className="w-5 h-5" />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The program's labels apply to generative AI in the <span className="text-foreground font-semibold">sound recording</span> itself.
              BASE Station goes further and voluntarily scores <span className="text-foreground font-semibold">lyrics, cover art, and video</span> too — via the Creative Ownership Score.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 justify-center mt-6">
            <Link to="/transparency"><Button variant="outline" className="rounded-full border-border text-foreground hover:bg-accent/10">Full transparency policy</Button></Link>
            <Link to="/creative-ownership"><Button variant="outline" className="rounded-full border-border text-foreground hover:bg-accent/10">How the score works</Button></Link>
          </div>
        </div>
      </div>

      {/* BASE Mark — forensic watermark */}
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#FF9A4D]/30 bg-[#FF9A4D]/10 px-4 py-1.5 text-[10px] font-bold tracking-widest uppercase text-[#FFC98A] mb-4">
            <Fingerprint className="w-3.5 h-3.5" /> Forensic Provenance
          </div>
          <h2 className="text-3xl font-black text-foreground mb-4">BASE Mark — Proof That Survives Everything</h2>
          <p className="text-muted-foreground text-lg max-w-3xl mx-auto">
            BASE Mark is BASE Station's in-house audio watermark: a single forensic signature embedded in the waveform itself — not in metadata. It survives metadata stripping, re-encoding, cutting, stem-splitting, sampling and remixing.
          </p>
        </div>

        <div className="merc-card rounded-2xl p-6 mb-6 border-l-2 border-l-[#34d399]/50">
          <p className="text-sm text-foreground">
            <strong>Status — live.</strong> The moment any audio asset is saved, BASE Station embeds <span className="font-semibold">both</span> layers automatically: a spectral spread-spectrum layer (instant, no GPU) and a neural-network layer on top (our own private GPU). The 32-bit registry payload is identical across both layers — either one traces any derivative audio back to the same track record.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="merc-card rounded-xl p-6">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: '#60a5fa1a', border: '1px solid #60a5fa40', color: '#60a5fa' }}>
              <ScanLine className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-foreground mb-2">Two layers, one signature</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              A blind localized spread-spectrum layer plus a learned neural layer — in the same class as Meta's AudioSeal and WavMark. Forensic redundancy: an attack that defeats one layer usually leaves the other intact.
            </p>
          </div>
          <div className="merc-card rounded-xl p-6">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: '#FFC98A1a', border: '1px solid #FFC98A40', color: '#FFC98A' }}>
              <Fingerprint className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-foreground mb-2">Lives in the audio, not the tags</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Unlike ID3 tags or C2PA manifests, the mark is woven into the waveform. Strip the metadata, re-encode, cut the track — the provenance is still right there, recoverable by anyone who scans it.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 justify-center mt-8">
          <Link to="/base-mark"><Button className="merc-button rounded-full">Verify a track</Button></Link>
          <Link to="/verify"><Button variant="outline" className="rounded-full border-border text-foreground hover:bg-accent/10">Public BASE Mark scan</Button></Link>
          <Link to="/docs"><Button variant="outline" className="rounded-full border-border text-foreground hover:bg-accent/10">Read the BASE Mark spec</Button></Link>
        </div>
      </div>

      {/* On-Chain Benefits Deep Dive */}
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-black text-foreground mb-4">Why On-Chain Ownership Matters</h2>
        </div>

        <div className="space-y-4">
          {[
            { title: 'Permanent Provenance', desc: 'Your track is stamped with an immutable timestamp and metadata. Forever. No disputes, no questions—the blockchain is your proof of creation.' },
            { title: 'Global Recognition', desc: 'Your music is globally verifiable. Licensing, publishing, and collaboration opportunities flow naturally.' },
            { title: 'Creator Royalties', desc: 'Smart contracts enable automatic royalty distribution to collaborators, producers, and featured artists. Get paid fairly, instantly.' },
            { title: 'Collectible Opportunities', desc: 'Mint your track as a collectible. Sell limited editions, exclusive mixes, or bundle perks for your most loyal fans.' },
            { title: 'No Middlemen', desc: 'Skip traditional gatekeepers. Your music goes directly from creation to the world, with you controlling distribution and pricing.' },
          ].map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.05 }}
              className="merc-card merc-card-hover p-6 rounded-xl transition-all"
            >
              <h3 className="font-bold text-foreground mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="border-t border-border/50 px-6 py-16 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-black text-foreground mb-4">Ready to Own Your Music?</h2>
          <p className="text-muted-foreground text-lg mb-8">
            Join thousands of creators building the future of music on Base Station.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/music-studio">
              <Button className="merc-button font-bold px-8 py-3 rounded-full">
                Start Creating 🎵
              </Button>
            </Link>
            <Link to="/">
              <Button variant="outline" className="border-border text-foreground hover:bg-accent/10 font-bold px-8 py-3 rounded-full">
                Explore the Platform
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 px-6">
        <div className="max-w-5xl mx-auto text-center text-xs text-muted-foreground">
          <p>Base Station: Human + AI on Chain. All creators welcome. Ownership guaranteed.</p>
        </div>
      </footer>
    </div>
  );
}