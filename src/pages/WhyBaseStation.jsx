import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Shield, Users, Zap, Lock, Heart, Sparkles, Fingerprint, ScanLine, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const FEATURES = [
  { icon: Shield, title: 'Immutable Ownership', desc: 'Human, AI-assisted, or fully AI-generated — every track is registered on-chain with permanent, verifiable provenance. No one disputes your authorship.', accent: '#60a5fa' },
  { icon: Sparkles, title: 'Creative Ownership Score', desc: 'A transparent score reflects how much human input shaped each track — across lyrics, cover art and video, not just the recording.', accent: '#34d399' },
  { icon: Fingerprint, title: 'BASE Mark™ Forensics', desc: 'A watermark woven into the waveform itself, surviving re-encoding, cuts, stem-splitting and remixing. Traces any derivative back to its origin.', accent: '#FFC98A' },
  { icon: Zap, title: 'AI-Human Hybrid Tools', desc: 'Cutting-edge AI for lyrics, music, cover art and video — built to amplify your skill, not replace it.', accent: '#fbbf24' },
  { icon: Lock, title: 'Creator Control', desc: 'You retain full ownership. Export, distribute globally, or keep work private — entirely your call.', accent: '#c4b5fd' },
  { icon: Heart, title: 'Community Support', desc: 'Build your fanbase, earn tips and plays, and collaborate with a global community that values your work.', accent: '#fb7185' },
];

const AUTO_PILLARS = [
  { icon: Fingerprint, title: 'BASE Mark embedding', desc: 'Both watermark layers — spectral and neural — are stamped onto the audio the instant a track is saved. No button to press.', accent: '#FFC98A' },
  { icon: Sparkles, title: 'Creative Ownership Score', desc: 'Provenance signals are tallied behind the scenes, so every asset ships with a score reflecting the human contribution.', accent: '#34d399' },
  { icon: Shield, title: 'On-chain registration', desc: 'Your track is written to the registry with an immutable timestamp and metadata — proof of creation that outlives any platform.', accent: '#60a5fa' },
  { icon: ShieldCheck, title: 'GenAI labeling', desc: 'Each recording is tagged AI-Generated, AI-Assisted or Human in line with the July 2026 music-community standard.', accent: '#fbbf24' },
];

export default function WhyBaseStation() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 inset-x-0 z-40 bg-background/85 backdrop-blur-xl border-b border-border/50 px-6 h-14 flex items-center">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-semibold">Back</span>
        </Link>
      </div>

      {/* Hero */}
      <div className="pt-16 pb-14 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Badge className="mb-4 border-[#FF9A4D]/30 bg-[#FF9A4D]/10 text-[#FFC98A] px-4 py-1.5 text-xs tracking-widest uppercase font-semibold">
              Our Mission
            </Badge>
            <h1 className="text-4xl md:text-6xl font-black text-foreground mb-5 tracking-tight leading-tight">
              Why Base Station<br />
              <span className="text-iridescent">for All Creators</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
              A platform built on one belief: <span className="text-foreground font-semibold">all music creation matters</span>. Human composers, AI experimenters, and hybrid artists are all equally valued — and equally protected.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Core Values */}
      <div className="max-w-6xl mx-auto px-6 pb-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="merc-card merc-card-hover p-5 rounded-2xl transition-all"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                  style={{ background: `${feature.accent}1a`, border: `1px solid ${feature.accent}40`, color: feature.accent }}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-black text-foreground mb-1.5">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Automatic / Transparency — the core differentiator */}
      <div className="border-y border-border/50 px-6 py-16 bg-card/30">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FF9A4D]/30 bg-[#FF9A4D]/10 px-4 py-1.5 text-[10px] font-bold tracking-widest uppercase text-[#FFC98A] mb-4">
              <ScanLine className="w-3.5 h-3.5" /> Built In. Not Bolted On.
            </div>
            <h2 className="text-3xl font-black text-foreground mb-4">Protection that just happens.</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
              You'd never know it was running if we weren't telling you. BASE Station quietly watermarks, scores, registers and labels every track the moment it's saved — so you stay focused on creating, and your provenance is airtight the second you hit save.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {AUTO_PILLARS.map((p, i) => {
              const Icon = p.icon;
              return (
                <motion.div
                  key={p.title}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="merc-card rounded-xl p-5 flex items-start gap-4"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${p.accent}1a`, border: `1px solid ${p.accent}40`, color: p.accent }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground mb-1">{p.title}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <p className="text-center text-sm text-muted-foreground mt-8 max-w-2xl mx-auto">
            We do all of this <span className="text-foreground font-semibold">by default</span> because transparency shouldn't be an opt-in. The only reason you notice is that we chose to show our work — every label, every score, every registry record is right there on the track.
          </p>

          <div className="flex flex-wrap gap-3 justify-center mt-6">
            <Link to="/base-mark"><Button className="merc-button rounded-full">Verify a track</Button></Link>
            <Link to="/transparency"><Button variant="outline" className="rounded-full border-border text-foreground hover:bg-accent/10">Transparency policy</Button></Link>
            <Link to="/creative-ownership"><Button variant="outline" className="rounded-full border-border text-foreground hover:bg-accent/10">How the score works</Button></Link>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="px-6 py-14 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-black text-foreground mb-3">Ready to own your music?</h2>
          <p className="text-muted-foreground text-lg mb-7">
            Join creators building the future of music on Base Station — protected by default, transparent by choice.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/music-studio">
              <Button className="merc-button font-bold px-8 py-3 rounded-full">Start Creating 🎵</Button>
            </Link>
            <Link to="/">
              <Button variant="outline" className="border-border text-foreground hover:bg-accent/10 font-bold px-8 py-3 rounded-full">Explore the Platform</Button>
            </Link>
          </div>
        </div>
      </div>

      <footer className="border-t border-border/50 py-8 px-6">
        <div className="max-w-5xl mx-auto text-center text-xs text-muted-foreground">
          <p>Base Station: Human + AI on Chain. All creators welcome. Ownership guaranteed.</p>
        </div>
      </footer>
    </div>
  );
}