import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Fingerprint, Gauge } from 'lucide-react';

// Advisory surface for a BASE Print seeded recovery.
//
// Deliberately muted and deliberately thin. Two rules from the forensic spec
// shape this card:
//   1. A Print match is RESEMBLANCE, not ownership. It renders as an advisory
//      note, never as a coloured disclosure badge, so it can never be mistaken
//      for the AI-origin label sitting above it.
//   2. Lift, beta, residual RMS and gate values are inside the trust boundary
//      (FORENSIC_SPEC §4). They live on the admin benchmark panel. Showing them
//      here would leak detector calibration to anyone with an episode page.
export default function PrintRecoveryCard({ episode, onUpdate }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const rec = episode.print_recovery;

  const scan = async () => {
    setBusy(true);
    const res = await base44.functions.invoke('printSeededEpisodeScan', { episode_id: episode.id });
    setBusy(false);
    if (res.data?.error) {
      return toast({ title: 'Scan failed', description: res.data.error, variant: 'destructive' });
    }
    if (res.data?.note) toast({ title: 'Scan complete', description: res.data.note });
    else if (res.data?.recovered) toast({ title: 'Match found', description: 'A registered recording was recovered after re-timing.' });
    else toast({ title: 'No match', description: 'No registered recording matched this audio.' });
    onUpdate?.(res.data.episode);
  };

  const confirmed = rec?.recovered && rec?.registry_confirmed;
  const unreadable = rec?.reason === 'non_pcm_source';

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/50 flex items-center gap-2">
          <Gauge className="w-3.5 h-3.5" /> Re-timing check
        </p>
        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-white/5 text-white/45 border border-white/10">
          Advisory — not an attribution
        </span>
      </div>

      {!rec ? (
        <>
          <p className="text-xs text-white/45 mb-3">
            Checks whether this audio matches a registered recording that was sped up or slowed down —
            the one edit our forensic watermark cannot follow on its own.
          </p>
          <button
            onClick={scan}
            disabled={busy}
            className="rounded-full px-4 py-1.5 text-xs font-bold border border-[#FF9A4D]/40 text-[#FF9A4D] hover:bg-[#FF9A4D]/10 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Fingerprint className="w-3.5 h-3.5" />}
            Run re-timing check
          </button>
        </>
      ) : confirmed ? (
        <div className="space-y-1.5">
          <p className="text-sm text-white/80">
            Possible match against a registered recording
            {rec.matched_title ? <span className="text-white font-semibold"> — {rec.matched_title}</span> : null}.
          </p>
          {rec.re_timing_detected && (
            <p className="text-xs text-white/45">Recovered after tempo re-timing was reversed.</p>
          )}
          <p className="text-[11px] text-white/35">
            Surfaced for human review only. This does not change the episode's origin label or its
            Creative Ownership Score.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <p className="text-sm text-white/60">
            {unreadable
              ? 'This episode\u2019s audio is a compressed file we can\u2019t analyse on the server yet.'
              : 'No registered recording matched this audio.'}
          </p>
          <p className="text-[11px] text-white/35">
            {unreadable
              ? 'That\u2019s a limit on what we can read — not a finding about the recording itself.'
              : 'A blank result is not evidence of anything, in either direction.'}
          </p>
          <button
            onClick={scan}
            disabled={busy}
            className="mt-1 rounded-full px-4 py-1.5 text-xs font-bold border border-white/15 text-white/70 hover:bg-white/5 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Fingerprint className="w-3.5 h-3.5" />}
            Check again
          </button>
        </div>
      )}
    </div>
  );
}