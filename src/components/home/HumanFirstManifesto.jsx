import { Link } from 'react-router-dom';
import { Brain, ChevronRight } from 'lucide-react';

/**
 * Human-First Manifesto — the platform's core creative philosophy.
 * Best-in-class tools, but human innovation over full-AI reliance.
 */
export default function HumanFirstManifesto() {
  return (
    <div className="rounded-xl border-2 border-black bg-gradient-to-b from-[#1F1408] to-[#0F0A06] p-5 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="flex items-center gap-2 mb-3">
        <Brain className="w-5 h-5 text-[#FFC98A]" />
        <h2 className="font-display text-white text-lg md:text-xl">Powerful Tools. Human-First Philosophy.</h2>
      </div>
      <div className="space-y-2.5 text-xs md:text-[13px] text-white/65 leading-relaxed">
        <p>
          We're proud to offer some of the best AI music tools in the industry — and we're constantly
          working to make them even better. Make no mistake: the technology here is powerful enough to
          run as a fully automated <span className="text-white/90 font-bold">"hit factory."</span>{' '}
          <span className="text-[#FFC98A] font-bold">We don't condone using it that way.</span>
        </p>
        <p>
          What we champion is <span className="text-white/90 font-bold">your brain, your innovation, and your
          creative process</span> — with AI as the instrument, never the artist. The creators who thrive here
          write their own lyrics, bring their own references, shape their own sound, and iterate until the
          work is truly theirs.
        </p>
        <p>
          And this isn't just talk — it's built into the platform. Content that leans heavily on the tools
          with minimal human direction is scored and labeled accordingly through our{' '}
          <span className="text-emerald-300 font-bold">Creative Ownership Score</span>, GenAI disclosure
          labels, and provenance methods. High reliance on AI means a lower score and an{' '}
          <span className="text-blue-300 font-bold">AI-Generated</span> label; real human participation earns
          the <span className="text-emerald-300 font-bold">AI-Assisted</span> label and the recognition that
          comes with it. Maximum human interaction isn't just encouraged — it's rewarded.
        </p>
        <p>
          Your ownership doesn't stop at a label. Every audio master saved here is sealed with the{' '}
          <span className="text-[#FFC98A] font-bold">BASE Mark</span> — our own inaudible signature woven
          into the waveform itself, combining a spectral layer and a neural layer so it survives stripped
          metadata, re-encoding, heavy compression, pitch and time shifts, even a two-second sample. Either
          layer alone points straight back to you, your score, and your provenance record. Combined with
          cryptographic manifests and on-chain anchoring, your human creative input isn't just measured —{' '}
          <span className="text-white/90 font-bold">it's permanently, provably yours.</span>
        </p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Link
          to="/creative-ownership"
          className="text-[10px] font-black rounded-full px-3.5 py-1.5 flex items-center gap-1 text-[#08201A]"
          style={{
            background: 'linear-gradient(135deg, #6EE7B7 0%, #10B981 100%)',
            boxShadow: '0 3px 10px -2px rgba(16,185,129,0.5)',
          }}
        >
          How Your Score Works <ChevronRight className="w-3 h-3" />
        </Link>
        <Link to="/transparency" className="text-[11px] font-bold text-[#FFC98A] hover:text-white transition-colors">
          Our AI Transparency Policy →
        </Link>
      </div>
    </div>
  );
}