import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import SpacialHistoryDialog from "@/components/about/SpacialHistoryDialog";

export default function About() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-12 text-slate-100">

      {/* HERO HEADER */}
      <motion.header
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="border-b border-amber-500/20 pb-8 mb-12"
      >
        <div className="flex items-center space-x-3 text-xs uppercase tracking-widest text-amber-500 mb-2 font-mono">
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" style={{ boxShadow: "0 0 8px #FF9A4D" }} />
          <span>Our DNA: Provenance &amp; Independence</span>
        </div>
        <h1 className="font-display text-4xl sm:text-5xl tracking-tight bg-gradient-to-r from-slate-100 via-slate-300 to-amber-500 bg-clip-text text-transparent">
          The Team Behind the Architecture
        </h1>
        <p className="mt-4 text-lg text-slate-400 max-w-3xl leading-relaxed">
          At BASE Station, we don't look at AI as a shortcut—we look at it as a new medium for human
          expression. Our mission is to provide creators with the ultimate toolkit to build boldly,
          track their input cleanly, and protect their rights transparently.
        </p>
      </motion.header>

      {/* THE BRIDGE: PAST TO PRESENT */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
        <div className="md:col-span-2 space-y-6 text-slate-300 text-base leading-relaxed">
          <h2 className="text-2xl font-semibold text-slate-100 tracking-tight">
            From Internet Radio to Generative Media: 25 Years of Creator Empowerment
          </h2>
          <p>
            This isn't our first time navigating an industry-shifting technological frontier. In the
            early 2000s, the emergence of webcasting threatened to upend the traditional music
            landscape. The technology was moving faster than the law, leaving independent hobbyists
            and digital broadcasters stranded without a clear, legal path forward.
          </p>
          <p>
            Our founder, <strong className="text-slate-100">Bryan Payne</strong> (former CEO of Spacial Audio),
            spearheaded the software ecosystem that solved that crisis. By launching <em>SAM Broadcaster</em>,
            Spacial revolutionized the industry—democratizing the airwaves so anyone with a PC could run a
            professional radio station. Crucially, we didn't just build broadcast automation; we built the
            underlying data logging and performance reporting framework that allowed independent webcasters
            to satisfy complex statutory rules, generate SoundExchange compliance sheets, and cleanly report
            to PROs.
          </p>
          <p>
            Today, the music community stands at a strikingly similar crossroads. Generative AI has opened
            unprecedented creative floodgates, yet legacy distribution networks and streaming platforms are
            reacting with blunt-force algorithmic bans and mass rejections out of fear of automated spam.
          </p>
          <SpacialHistoryDialog />
        </div>

        {/* TECH SPEC SIDEBAR */}
        <div className="merc-card rounded-lg p-6 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl" />
          <div>
            <h3 className="text-xs uppercase tracking-widest text-amber-500 font-bold mb-4 font-mono">Architectural Legacy</h3>
            <ul className="space-y-4 text-xs text-slate-400">
              <li>
                <strong className="text-slate-200 block mb-1">1999–2010s Era:</strong>
                Standardized streaming automation, built-in metadata encoders, and automated statutory
                reporting for thousands of webcasters globally.
              </li>
              <li>
                <strong className="text-slate-200 block mb-1">2026 Innovation Layer:</strong>
                Voluntary, track-level provenance logging, AI-assisted credit frameworks, and
                multi-studio creative signaling.
              </li>
            </ul>
          </div>
          <div className="border-t border-white/10 pt-4 mt-6 text-center">
            <span className="text-[10px] font-mono text-slate-500 uppercase">System Status: Native Compliance Engine</span>
          </div>
        </div>
      </section>

      {/* THE SOLUTION: CREATIVE OWNERSHIP SCORE */}
      <section className="border border-amber-500/10 merc-card rounded-xl p-8 mb-16">
        <div className="max-w-3xl">
          <h2 className="text-2xl font-semibold text-slate-100 mb-4 tracking-tight">
            The Vision: Protecting the Artist through Provenance
          </h2>
          <p className="text-slate-300 mb-6 leading-relaxed">
            History proved that the solution to a technical and legal standoff isn't to ban the
            technology—it is to bring transparency, data accountability, and structure to it. Artists
            shouldn't have to hide their tools. They simply need a way to prove their authorship.
          </p>
          <p className="text-slate-300 mb-6 leading-relaxed">
            That is why we built the{" "}
            <Link to="/creative-ownership" className="font-bold text-amber-500 hover:text-amber-400 underline underline-offset-2">
              Creative Ownership Score (0–100 COS)
            </Link>{" "}
            directly into BASE Station. Rather than treating AI generation as an unvetted "black box,"
            our native algorithm meticulously captures a creator's explicit intent. When you write custom
            lyrics, feed specific audio references, establish style constraints, and iteratively refine
            your arrangements, the platform documents those human inputs.
          </p>
          <p className="text-slate-300 leading-relaxed">
            By providing an immutable ledger of creative signals, we separate low-effort automated spam
            from genuine, hybrid human collaboration. This methodology aligns perfectly with the music
            community's voluntary track-level labeling program, ensuring that your work qualifies for
            transparent, human-guided credits rather than facing suppression.
          </p>
        </div>
      </section>

      {/* ADVOCACY / CALL TO ACTION */}
      <footer className="text-center max-w-2xl mx-auto space-y-6 pb-8">
        <h3 className="text-xl font-medium text-slate-100">Join the Next Evolution</h3>
        <p className="text-sm text-slate-400 leading-relaxed">
          We believe the brightest future belongs to the creators who leverage technology to expand
          their artistic horizon, without letting go of the steering wheel. Create boldly. Disclose
          transparently. Protect your catalog.
        </p>
        <div className="pt-4">
          <Link
            to="/creator-dashboard"
            className="inline-block merc-button font-mono text-xs uppercase font-bold tracking-wider px-6 py-3 rounded-md transition-colors duration-200"
          >
            Enter Your Dashboard
          </Link>
        </div>
      </footer>

    </div>
  );
}