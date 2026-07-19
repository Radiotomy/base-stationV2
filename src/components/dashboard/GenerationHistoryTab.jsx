import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Music, FileText, Image, Film, CheckCircle, AlertCircle, Clock, Loader2, ExternalLink, RefreshCw, Trash2, RotateCcw, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import EmptyStateTeacher from '@/components/common/EmptyStateTeacher';

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

// Routing map: job_type → studio path
const STUDIO_PATHS = {
  music:     '/music-studio',
  lyrics:    '/lyrics-studio',
  cover_art: '/cover-art-studio',
  video:     '/video-studio',
};

// Build a regenerate link with prompt/genre/mood pre-filled via URL params
function buildRegenLink(path, job) {
  const params = new URLSearchParams();
  const d = job.input_data || {};
  if (d.prompt)        params.set('prompt', d.prompt);
  if (d.lyrics)        params.set('lyrics', d.lyrics);
  if (d.genre)         params.set('genre', d.genre);
  if (d.mood)          params.set('mood', d.mood);
  if (d.duration)      params.set('duration', d.duration);
  if (d.style)         params.set('style', d.style);
  if (job.provider)    params.set('provider', job.provider);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

function JobRow({ job, onDelete }) {
  const Icon = JOB_ICONS[job.job_type] || Music;
  const color = JOB_COLORS[job.job_type] || JOB_COLORS.music;
  const status = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;
  const StatusIcon = status.icon;

  // Provenance: model version from output_metadata or input_data
  const modelVersion = job.output_metadata?.model_version || job.input_data?.model || null;
  const createdAt = job.created_date
    ? new Date(job.created_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
    : null;
  const studioPath = STUDIO_PATHS[job.job_type];

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-2xl bg-card border border-border hover:border-purple-500/20 transition-all group">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex-shrink-0 flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white/70" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <p className="font-bold text-sm text-foreground capitalize">{job.job_type} Generation</p>
            <Badge variant="outline" className="text-xs capitalize">{job.provider}</Badge>
            {modelVersion && (
              <Badge className="text-xs bg-purple-500/10 text-purple-300 border-purple-500/20 flex items-center gap-1">
                <Shield className="w-2.5 h-2.5" /> {modelVersion}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            {job.input_data?.genre && <span>{job.input_data.genre}</span>}
            {job.input_data?.mood  && <span>{job.input_data.mood}</span>}
            {job.credits_used > 0  && <span className="text-yellow-500">{job.credits_used} cr</span>}
            {createdAt             && <span>{createdAt}</span>}
          </div>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${status.bg} ${status.color} flex-shrink-0`}>
          <StatusIcon className={`w-3.5 h-3.5 ${status.spin ? 'animate-spin' : ''}`} />
          <span className="capitalize">{job.status}</span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {job.output_url && (
            <a href={job.output_url} target="_blank" rel="noopener noreferrer">
              <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" title="Open output">
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </a>
          )}
          {studioPath && (
            <Link to={buildRegenLink(studioPath, job)} title="Re-generate with same prompt">
              <Button size="sm" variant="ghost" className="h-8 rounded-lg text-cyan-400 hover:bg-cyan-500/10 gap-1 px-2 text-xs font-bold">
                <RotateCcw className="w-3 h-3" /> Re-generate
              </Button>
            </Link>
          )}
          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
            onClick={() => onDelete(job.id)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Provenance footer */}
      {(modelVersion || job.output_metadata?.content_hash) && (
        <div className="mt-2.5 pt-2.5 border-t border-border/50 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          <Shield className="w-3 h-3 text-emerald-400 flex-shrink-0" />
          {modelVersion && <span>Made with <span className="font-semibold text-foreground">{job.provider} {modelVersion}</span></span>}
          {createdAt && <span>on {createdAt}</span>}
          {job.output_metadata?.content_hash && (
            <span className="font-mono opacity-50 truncate max-w-[120px]" title={job.output_metadata.content_hash}>
              #{job.output_metadata.content_hash.slice(0, 8)}
            </span>
          )}
        </div>
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

  const deleteJob = async (id) => {
    await base44.entities.GenerationJob.delete(id);
    setJobs(prev => prev.filter(j => j.id !== id));
    toast.success('Entry removed');
  };

  const clearAll = async () => {
    await Promise.all(jobs.map(j => base44.entities.GenerationJob.delete(j.id)));
    setJobs([]);
    toast.success('History cleared');
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
        <div className="flex gap-2">
          {jobs.length > 0 && (
            <Button onClick={clearAll} size="sm" variant="ghost" className="rounded-lg gap-1.5 text-xs text-destructive hover:bg-destructive/10">
              <Trash2 className="w-3 h-3" /> Clear All
            </Button>
          )}
          <Button onClick={load} size="sm" variant="ghost" className="rounded-lg gap-1.5 text-xs">
            <RefreshCw className="w-3 h-3" /> Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        jobs.length === 0 ? (
          <EmptyStateTeacher
            emoji="🕘"
            title="Your generation history lives here"
            description="Every AI generation you run — music, lyrics, art, video — is logged here with its provider, credits used, and a one-click re-generate."
            actionLabel="Generate Something"
            actionTo="/studios"
          />
        ) : (
          <div className="text-center py-12 border border-dashed border-border rounded-2xl">
            <Clock className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground text-sm">Nothing matches this filter</p>
          </div>
        )
      ) : (
        <div className="space-y-2">
          {filtered.map(job => <JobRow key={job.id} job={job} onDelete={deleteJob} />)}
        </div>
      )}
    </div>
  );
}