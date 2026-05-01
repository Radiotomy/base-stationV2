import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Folder, Music, FileText, Image, Film, ExternalLink, Trash2, Edit2, CheckCircle, X, Loader2, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const STATUS_COLORS = {
  draft:       'bg-muted text-muted-foreground',
  in_progress: 'bg-blue-500/20 text-blue-400',
  complete:    'bg-emerald-500/20 text-emerald-400',
  published:   'bg-purple-500/20 text-purple-400',
};

function ProjectCard({ project, assets, onDelete, onEdit }) {
  const hasTrack    = !!project.track_url || !!project.track_asset_id;
  const hasLyrics   = !!project.lyrics_text || !!project.lyrics_asset_id;
  const hasCoverArt = !!project.cover_image_url || !!project.cover_art_asset_id;
  const hasVideo    = !!project.video_url || !!project.video_asset_id;
  const completionCount = [hasTrack, hasLyrics, hasCoverArt, hasVideo].filter(Boolean).length;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-2xl border border-border hover:border-purple-500/30 transition-all p-5 group">
      <div className="flex items-start gap-4 mb-4">
        <div className="w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden bg-gradient-to-br from-indigo-700 to-purple-800 flex items-center justify-center">
          {project.cover_image_url
            ? <img src={project.cover_image_url} alt={project.title} className="w-full h-full object-cover" />
            : <Folder className="w-6 h-6 text-white/40" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-black text-sm text-foreground truncate">{project.title}</h3>
            <Badge className={`text-xs border-0 flex-shrink-0 ${STATUS_COLORS[project.status]}`}>{project.status}</Badge>
          </div>
          {project.description && <p className="text-xs text-muted-foreground line-clamp-1">{project.description}</p>}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <Button onClick={() => onEdit(project)} size="icon" variant="ghost" className="h-7 w-7 rounded-lg">
            <Edit2 className="w-3.5 h-3.5" />
          </Button>
          <Button onClick={() => onDelete(project.id)} size="icon" variant="ghost"
            className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Asset completion */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {[
          { label: 'Track', icon: Music, done: hasTrack, url: project.track_url },
          { label: 'Lyrics', icon: FileText, done: hasLyrics },
          { label: 'Art', icon: Image, done: hasCoverArt, url: project.cover_image_url },
          { label: 'Video', icon: Film, done: hasVideo, url: project.video_url },
        ].map(({ label, icon: Icon, done, url }) => (
          <div key={label}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-center transition-colors ${done ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border bg-muted/20'}`}>
            <Icon className={`w-4 h-4 ${done ? 'text-emerald-400' : 'text-muted-foreground opacity-40'}`} />
            <span className="text-xs font-semibold text-muted-foreground">{label}</span>
            {done && <CheckCircle className="w-3 h-3 text-emerald-400" />}
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(completionCount / 4) * 100}%` }} />
        </div>
        <span className="text-xs text-muted-foreground">{completionCount}/4</span>
      </div>

      {project.genre || project.mood ? (
        <div className="flex gap-1.5 mt-3">
          {project.genre && <Badge variant="outline" className="text-xs">{project.genre}</Badge>}
          {project.mood && <Badge variant="outline" className="text-xs">{project.mood}</Badge>}
          {project.bpm && <Badge variant="outline" className="text-xs">{project.bpm} BPM</Badge>}
        </div>
      ) : null}
    </motion.div>
  );
}

function ProjectModal({ project, assets, onClose, onSave }) {
  const [form, setForm] = useState(project || {
    title: '', description: '', status: 'draft',
    track_url: '', lyrics_text: '', cover_image_url: '', video_url: '',
    genre: '', mood: '', bpm: '',
  });
  const [saving, setSaving] = useState(false);

  const trackAssets    = assets.filter(a => a.asset_type === 'track');
  const lyricAssets    = assets.filter(a => a.asset_type === 'lyric');
  const coverartAssets = assets.filter(a => a.asset_type === 'coverart');

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Title required'); return; }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}
        className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-black text-foreground">{project ? 'Edit Project' : 'New Project'}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        <div className="space-y-3">
          <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Project title…" className="rounded-xl" />
          <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Description (optional)" className="rounded-xl" />

          <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="complete">Complete</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>

          <div className="border-t border-border pt-3 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Link Assets</p>

            {/* Track */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Track URL or from library</label>
              <Input value={form.track_url} onChange={e => setForm(f => ({ ...f, track_url: e.target.value }))}
                placeholder="https://… or paste generated URL" className="rounded-xl text-xs mb-1" />
              {trackAssets.length > 0 && (
                <Select value={form.track_asset_id || ''} onValueChange={v => {
                  const a = trackAssets.find(x => x.id === v);
                  setForm(f => ({ ...f, track_asset_id: v, track_url: a?.file_url || f.track_url }));
                }}>
                  <SelectTrigger className="rounded-xl text-xs"><SelectValue placeholder="Pick from library" /></SelectTrigger>
                  <SelectContent>
                    {trackAssets.map(a => <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Cover Art */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Cover Art URL</label>
              <Input value={form.cover_image_url} onChange={e => setForm(f => ({ ...f, cover_image_url: e.target.value }))}
                placeholder="https://…" className="rounded-xl text-xs mb-1" />
              {coverartAssets.length > 0 && (
                <Select value={form.cover_art_asset_id || ''} onValueChange={v => {
                  const a = coverartAssets.find(x => x.id === v);
                  setForm(f => ({ ...f, cover_art_asset_id: v, cover_image_url: a?.file_url || f.cover_image_url }));
                }}>
                  <SelectTrigger className="rounded-xl text-xs"><SelectValue placeholder="Pick from library" /></SelectTrigger>
                  <SelectContent>
                    {coverartAssets.map(a => <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Lyrics */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Lyrics</label>
              <textarea value={form.lyrics_text} onChange={e => setForm(f => ({ ...f, lyrics_text: e.target.value }))}
                placeholder="Paste lyrics here…" rows={3}
                className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
            </div>

            {/* Video */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Video URL</label>
              <Input value={form.video_url} onChange={e => setForm(f => ({ ...f, video_url: e.target.value }))}
                placeholder="https://…" className="rounded-xl text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 border-t border-border pt-3">
            <Input value={form.genre} onChange={e => setForm(f => ({ ...f, genre: e.target.value }))}
              placeholder="Genre" className="rounded-xl text-xs" />
            <Input value={form.mood} onChange={e => setForm(f => ({ ...f, mood: e.target.value }))}
              placeholder="Mood" className="rounded-xl text-xs" />
            <Input type="number" value={form.bpm} onChange={e => setForm(f => ({ ...f, bpm: e.target.value }))}
              placeholder="BPM" className="rounded-xl text-xs" />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button onClick={onClose} variant="outline" className="flex-1 rounded-xl">Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1 rounded-xl bg-purple-600 hover:bg-purple-500 gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {project ? 'Save' : 'Create'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function ProjectsTab({ userId, assets }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);

  useEffect(() => {
    if (!userId) return;
    base44.entities.Project.filter({ user_id: userId }, '-created_date', 50)
      .then(setProjects).finally(() => setLoading(false));
  }, [userId]);

  const handleSave = async (form) => {
    if (editingProject) {
      const updated = await base44.entities.Project.update(editingProject.id, form);
      setProjects(p => p.map(x => x.id === editingProject.id ? { ...x, ...form } : x));
      toast.success('Project updated!');
    } else {
      const created = await base44.entities.Project.create({ ...form, user_id: userId });
      setProjects(p => [created, ...p]);
      toast.success('Project created!');
    }
    setShowModal(false);
    setEditingProject(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this project?')) return;
    await base44.entities.Project.delete(id);
    setProjects(p => p.filter(x => x.id !== id));
    toast.success('Project deleted');
  };

  const handleEdit = (project) => { setEditingProject(project); setShowModal(true); };
  const handleNew  = () => { setEditingProject(null); setShowModal(true); };

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-muted-foreground">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        <Button onClick={handleNew} className="rounded-xl gap-2 bg-purple-600 hover:bg-purple-500 text-sm font-bold">
          <Plus className="w-4 h-4" /> New Project
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-2xl">
          <Folder className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground font-medium mb-2">No projects yet</p>
          <p className="text-xs text-muted-foreground mb-4">Bundle your track, lyrics, cover art and video into a project</p>
          <Button onClick={handleNew} className="rounded-xl gap-2 bg-purple-600 hover:bg-purple-500">
            <Plus className="w-4 h-4" /> Create First Project
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map(p => (
            <ProjectCard key={p.id} project={p} assets={assets}
              onDelete={handleDelete} onEdit={handleEdit} />
          ))}
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <ProjectModal
            project={editingProject}
            assets={assets}
            onClose={() => { setShowModal(false); setEditingProject(null); }}
            onSave={handleSave}
          />
        )}
      </AnimatePresence>
    </div>
  );
}