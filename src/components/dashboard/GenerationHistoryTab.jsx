import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Music, FileText, Image, Film, CheckCircle, AlertCircle, Clock, Loader2, ExternalLink, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const JOB_ICONS = { music: Music, lyrics: FileText, cover_art: Image, video: Film };
const JOB_COLORS = {
  music:     'from-blue-600 to-cyan-700',
  lyrics:    'from-pink-600 to-rose-700',
  cover_art: 'from-purple-600 to-violet-700',
  video:     'from-indigo-600 to-purple-700',
};
const STATUS_CONFIG = {
  completed:  { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  failed:     { icon: AlertCircle, color: 'text-destructive',  bg: 'bg-destructive/10' },
  processing: { icon: Loader2,     color: 'text-blue-400',     bg: 'bg-blue-500/10', spin: true },
  pending:    { icon: Clock,       color: 'text-yellow-400',   bg: 'bg-yellow-500/10' },
};

function JobRow({ job }) {
  const Icon = JOB_ICONS[job.job_type] || Music;
  const color = JOB_COLORS[job.job_type] || JOB_COLORS.music;
  const status = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;
  const StatusIcon = status.icon;

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border hover:border-purple-500/20 transition-all group">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex-shrink-0 flex items-center justify-center`}>
        <Icon className="w-5 h-5 text-white/70" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="font-bold text-sm text-foreground capitalize">{job.job_type} Generation</p>
          <Badge variant="outline" className="text-xs capitalize">{job.provider}</Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {job.input_data?.genre && <span>{job.input_data.genre}</span>}
          {job.input_data?.mood && <span>{job.input_data.mood}</span>}
          {job.credits_used > 0 && <span>{job.credits_used} credits</span>}
          <span>{new Date(job.created_date).toLocaleDateString()}</span>
        </div>
      </div>
      <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${status.bg} ${status.color} flex-shrink-0`}>
        <StatusIcon className={`w-3.5 h-3.5 ${status.spin ? 'animate-spin' : ''}`} />
        <span className="capitalize">{job.status}</span>
      </div>
      {job.output_url && (
        <a href={job.output_url} target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg">
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        </a>
      )}
    </motion.div>
  );
}

export default function GenerationHistoryTab({ userId }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.GenerationJob.filter({ user_id: userId }, '-created_date', 50);
    setJobs(data);
    setLoading(false);
  };

  useEffect(() => { if (userId) load(); }, [userId]);

  const filtered = filter === 'all' ? jobs : jobs.filter(j => j.job_type === filter || j.status === filter);

  const counts = {
    all: jobs.length,
    music: jobs.filter(j => j.job_type === 'music').length,
    lyrics: jobs.filter(j => j.job_type === 'lyrics').length,
    cover_art: jobs.filter(j => j.job_type === 'cover_art').length,
    video: jobs.filter(j => j.job_type === 'video').length,
    completed: jobs.filter(j => j.status === 'completed').length,
    failed: jobs.filter(j => j.status === 'failed').length,
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'all',       label: `All (${counts.all})` },
            { key: 'music',     label: `🎵 Music (${counts.music})` },
            { key: 'lyrics',    label: `📝 Lyrics (${counts.lyrics})` },
            { key: 'cover_art', label: `🎨 Art (${counts.cover_art})` },
            { key: 'video',     label: `🎬 Video (${counts.video})` },
            { key: 'failed',    label: `⚠️ Failed (${counts.failed})` },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filter === key ? 'bg-purple-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
              {label}
            </button>
          ))}
        </div>
        <Button onClick={load} size="sm" variant="ghost" className="rounded-lg gap-1.5 text-xs">
          <RefreshCw className="w-3 h-3" /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-2xl">
          <Clock className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground text-sm">No generation history yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(job => <JobRow key={job.id} job={job} />)}
        </div>
      )}
    </div>
  );
}