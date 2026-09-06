import { ExternalLink, AlertTriangle, CheckCircle2, MinusCircle, EyeOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// One examined Audius track. The wording here is load-bearing: a Print hit is a
// RESEMBLANCE measurement and carries no payload, so this row must never read as
// an infringement claim. It says "resembles" and shows the warp factor, because
// the fitted geometry is the number that tells an admin whether to believe it.
const STATUS = {
  resembles_registered_work: {
    label: 'Resembles a registered work',
    cls: 'bg-amber-500/15 text-amber-200 border-amber-500/30',
    Icon: AlertTriangle,
  },
  no_match: { label: 'No match', cls: 'bg-white/5 text-muted-foreground border-white/10', Icon: MinusCircle },
  own_release: { label: 'Our own release', cls: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30', Icon: CheckCircle2 },
  not_scannable: { label: 'Could not read audio', cls: 'bg-white/5 text-muted-foreground border-white/10', Icon: EyeOff },
  error: { label: 'Error', cls: 'bg-destructive/15 text-destructive border-destructive/30', Icon: AlertTriangle },
};

export default function SweepFindingRow({ finding }) {
  const meta = STATUS[finding.match_status] || STATUS.no_match;
  const { Icon } = meta;

  return (
    <div className="merc-card rounded-xl p-3 flex items-start gap-3">
      <Icon className="w-4 h-4 mt-0.5 shrink-0 text-[#FF9A4D]" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-bold text-sm text-foreground truncate">
            {finding.audius_title || finding.audius_track_id}
          </p>
          <Badge variant="outline" className={`text-[10px] ${meta.cls}`}>{meta.label}</Badge>
        </div>

        <p className="text-xs text-muted-foreground mt-0.5">
          {finding.audius_handle ? `@${finding.audius_handle}` : 'unknown uploader'}
          {finding.audius_artist_name ? ` · ${finding.audius_artist_name}` : ''}
        </p>

        {finding.match_status === 'resembles_registered_work' && (
          <div className="mt-2 rounded-lg bg-amber-500/5 border border-amber-500/20 p-2 space-y-1">
            <p className="text-xs text-foreground">
              Resembles <span className="font-bold">{finding.matched_asset_title || finding.matched_asset_id}</span>
            </p>
            <p className="text-[11px] text-muted-foreground font-mono">
              lift {finding.lift} · warp {finding.beta} · {finding.inliers} inliers
              {finding.residual_rms != null ? ` · rms ${finding.residual_rms.toFixed(3)}s` : ''}
            </p>
            {/* Stated on every hit, not buried in docs: resemblance is not proof,
                and only a confirmed spectral recovery can make it one. */}
            <p className="text-[11px] text-amber-200/80">
              Acoustic resemblance only — not proof of authorship. A BASE Mark recovery is still required
              {finding.spectral_confirmed === 'attributed' ? ' (confirmed).' : ' (not attempted).'}
            </p>
          </div>
        )}

        {finding.reason && finding.match_status !== 'resembles_registered_work' && (
          <p className="text-[11px] text-muted-foreground mt-1 font-mono break-all">{finding.reason}</p>
        )}
      </div>

      {finding.audius_permalink && (
        <a
          href={`https://audius.co${finding.audius_permalink}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground shrink-0"
          title="Open on Audius"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      )}
    </div>
  );
}