import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Music, Zap, Eye, Heart, Loader2 } from 'lucide-react';

/**
 * Per-track analytics — for each track in the user's library, shows the
 * credits it cost to generate (from the matching GenerationJob) and, if the
 * track was submitted to the community charts, its plays & likes.
 */
export default function PerTrackAnalytics({ userId, assets }) {
  const [jobs, setJobs] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    Promise.all([
      base44.entities.GenerationJob.filter({ user_id: userId, job_type: 'music' }, '-created_date', 200).catch(() => []),
      base44.entities.TrackSubmission.filter({ artist_id: userId }, '-created_date', 100).catch(() => []),
    ]).then(([j, s]) => { setJobs(j); setSubmissions(s); }).finally(() => setLoading(false));
  }, [userId]);

  const tracks = (assets || []).filter(a => a.asset_type === 'track');

  if (loading) return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  );

  if (tracks.length === 0) return null;

  const rows = tracks.map(t => {
    const job = jobs.find(j => j.output_url === t.file_url);
    const submission = submissions.find(s => s.track_url === t.file_url);
    return {
      id: t.id,
      title: t.title,
      credits: job?.credits_used ?? t.metadata?.credit_cost ?? null,
      plays: submission?.play_count ?? null,
      likes: submission?.like_count ?? null,
    };
  });

  return (
    <div className="space-y-3 p-5 rounded-2xl bg-card border border-border">
      <h3 className="text-sm font-black text-foreground flex items-center gap-2">
        <Music className="w-4 h-4 text-blue-400" /> Per-Track Analytics
      </h3>
      <div className="space-y-2">
        {rows.map(r => (
          <div key={r.id} className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-muted/30">
            <span className="text-xs font-semibold text-foreground truncate flex-1">{r.title}</span>
            <div className="flex items-center gap-3 flex-shrink-0">
              {r.credits != null && (
                <span className="flex items-center gap-1 text-xs text-yellow-400"><Zap className="w-3 h-3" />{r.credits} cr</span>
              )}
              {r.plays != null && (
                <span className="flex items-center gap-1 text-xs text-cyan-400"><Eye className="w-3 h-3" />{r.plays}</span>
              )}
              {r.likes != null && (
                <span className="flex items-center gap-1 text-xs text-pink-400"><Heart className="w-3 h-3" />{r.likes}</span>
              )}
              {r.credits == null && r.plays == null && r.likes == null && (
                <span className="text-xs text-muted-foreground">No data yet</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}