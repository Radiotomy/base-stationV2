import { BadgeCheck } from 'lucide-react';

/**
 * Required attribution for Aurora.
 *
 * The MiniMax-Music3 COMMUNITY LICENSE (clause 3.1) requires the string
 * "MiniMax-Music3" to be prominently displayed on the user interface of any
 * commercial product or service that uses the model. This component is that
 * display — it is a LICENCE CONDITION, not decoration, so it must render
 * wherever Aurora is offered or an Aurora result is shown, and must never be
 * hidden behind a tooltip, a collapsed panel or a hover state.
 *
 * `variant="badge"` is the compact form for result cards; the default is the
 * full notice used at the top of the studio tab.
 */
export default function MiniMaxAttribution({ variant = 'notice' }) {
  if (variant === 'badge') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-200 text-[11px] font-bold">
        <BadgeCheck className="w-3 h-3" />
        Powered by MiniMax-Music3
      </span>
    );
  }
  return (
    <div className="p-3 rounded-xl border bg-amber-500/10 border-amber-500/30 flex items-start gap-2.5">
      <BadgeCheck className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
      <p className="text-xs text-amber-100/90">
        <span className="font-bold text-amber-300">Aurora</span> is BASE Station's long-form song
        engine, <span className="font-bold">powered by MiniMax-Music3</span> — the open-weight
        MiniMax Music 3 model, deployed and run on our own infrastructure. Renders are native
        32&nbsp;kHz 16-bit stereo WAV, so every master is lossless PCM.
      </p>
    </div>
  );
}