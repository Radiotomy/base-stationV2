import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Shield, Users, Zap, Lock, Heart, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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