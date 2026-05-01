import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, Search, Heart, Copy, Zap, Music2, FileText, Image, Video, Star, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const STUDIO_ICONS = { music: Music2, lyrics: FileText, cover_art: Image, video: Video };
const STUDIO_COLORS = {
  music:     'bg-blue-500/20 text-blue-300 border-blue-500/30',
  lyrics:    'bg-pink-500/20 text-pink-300 border-pink-500/30',
  cover_art: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  video:     'bg-orange-500/20 text-orange-300 border-orange-500/30',
};
const STUDIO_LABELS = { music: 'Music', lyrics: 'Lyrics', cover_art: 'Cover Art', video: 'Video' };

const GENRES = ['Hip-Hop', 'EDM', 'Pop', 'R&B', 'Rock', 'Lo-Fi', 'Jazz', 'Trap', 'Ambient', 'Other'];
const MOODS  = ['Energetic', 'Chill', 'Dark', 'Happy', 'Sad', 'Uplifting', 'Aggressive', 'Romantic'];

function TemplateCard({ template, onUse, onLike, isOwner, onDelete }) {
  const Icon = STUDIO_ICONS[template.studio_type] || Music2;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-2xl border border-border p-5 flex flex-col gap-3 hover:border-border/80 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Badge className={`${STUDIO_COLORS[template.studio_type]} border text-xs flex-shrink-0`}>
            <Icon className="w-3 h-3 mr-1" />{STUDIO_LABELS[template.studio_type]}
          </Badge>
          {template.is_featured && <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 border text-xs">⭐ Featured</Badge>}
        </div>
        {isOwner && (
          <button onClick={() => onDelete(template.id)} className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div>
        <h3 className="font-black text-foreground text-sm mb-1">{template.title}</h3>
        {template.description && <p className="text-xs text-muted-foreground">{template.description}</p>}
      </div>

      <div className="flex-1 bg-muted/30 rounded-xl p-3">
        <p className="text-xs text-muted-foreground font-mono leading-relaxed line-clamp-3">{template.prompt}</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {template.genre && <Badge variant="outline" className="text-xs">{template.genre}</Badge>}
        {template.mood && <Badge variant="outline" className="text-xs">{template.mood}</Badge>}
        {template.tags?.slice(0, 2).map(t => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-border">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Copy className="w-3 h-3" />{template.use_count || 0}</span>
          <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{template.like_count || 0}</span>
        </div>
        <div className="flex gap-1.5">
          <Button onClick={() => onLike(template)} size="sm" variant="outline" className="rounded-lg h-7 px-2 gap-1 text-xs">
            <Heart className="w-3 h-3" />
          </Button>
          <Button onClick={() => onUse(template)} size="sm" className="rounded-lg h-7 px-3 gap-1 text-xs bg-purple-600 hover:bg-purple-500">
            <Copy className="w-3 h-3" /> Use
          </Button>
        </div>
      </div>

      {template.user_name && (
        <p className="text-xs text-muted-foreground/60">by {template.user_name}</p>
      )}
    </motion.div>
  );
}

function CreateTemplateModal({ onClose, onCreated, user }) {
  const [form, setForm] = useState({
    title: '', description: '', studio_type: 'music', prompt: '', genre: '', mood: '', tags: '', is_public: true,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.title || !form.prompt) { toast.error('Title and prompt are required'); return; }
    setSaving(true);
    try {
      const tagsArr = form.tags.split(',').map(t => t.trim()).filter(Boolean);
      const newTpl = await base44.entities.PromptTemplate.create({
        user_id: user.id,
        user_email: user.email,
        user_name: user.full_name,
        title: form.title,
        description: form.description,
        studio_type: form.studio_type,
        prompt: form.prompt,
        genre: form.genre || undefined,
        mood: form.mood || undefined,
        tags: tagsArr,
        is_public: form.is_public,
        use_count: 0,
        like_count: 0,
      });
      toast.success('Template shared with the community!');
      onCreated(newTpl);
      onClose();
    } catch (err) { toast.error(err.message); }
    setSaving(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }}
        className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-black text-foreground text-lg">Share a Template</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Title *</label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Dark Trap Banger" className="rounded-xl" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Studio</label>
            <Select value={form.studio_type} onValueChange={v => setForm(f => ({ ...f, studio_type: v }))}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="music">🎵 Music</SelectItem>
                <SelectItem value="lyrics">📝 Lyrics</SelectItem>
                <SelectItem value="cover_art">🎨 Cover Art</SelectItem>
                <SelectItem value="video">🎬 Video</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Prompt *</label>
            <Textarea value={form.prompt} onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))}
              placeholder="The full prompt text…" rows={4} className="rounded-xl text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Description</label>
            <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Short description of what this creates" className="rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Genre</label>
              <Select value={form.genre} onValueChange={v => setForm(f => ({ ...f, genre: v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>{GENRES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Mood</label>
              <Select value={form.mood} onValueChange={v => setForm(f => ({ ...f, mood: v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>{MOODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Tags (comma-separated)</label>
            <Input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
              placeholder="trap, 808, dark, melodic" className="rounded-xl" />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={onClose} variant="outline" className="flex-1 rounded-xl">Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1 rounded-xl bg-purple-600 hover:bg-purple-500 gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Share Template
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function CommunityTemplates() {
  const [user, setUser] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStudio, setFilterStudio] = useState('all');
  const [filterGenre, setFilterGenre] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    base44.auth.me().catch(() => null).then(u => setUser(u));
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.PromptTemplate.filter({ is_public: true }, '-like_count', 100);
      setTemplates(data);
    } catch (err) { toast.error(err.message); }
    setLoading(false);
  };

  const handleUse = async (tpl) => {
    navigator.clipboard.writeText(tpl.prompt).catch(() => {});
    setCopiedId(tpl.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('Prompt copied to clipboard!');
    // Increment use count
    base44.entities.PromptTemplate.update(tpl.id, { use_count: (tpl.use_count || 0) + 1 }).catch(() => {});
    setTemplates(prev => prev.map(t => t.id === tpl.id ? { ...t, use_count: (t.use_count || 0) + 1 } : t));
  };

  const handleLike = async (tpl) => {
    const newCount = (tpl.like_count || 0) + 1;
    base44.entities.PromptTemplate.update(tpl.id, { like_count: newCount }).catch(() => {});
    setTemplates(prev => prev.map(t => t.id === tpl.id ? { ...t, like_count: newCount } : t));
    toast.success('❤️ Liked!');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this template?')) return;
    await base44.entities.PromptTemplate.delete(id);
    setTemplates(prev => prev.filter(t => t.id !== id));
    toast.success('Template deleted');
  };

  const handleCreated = (tpl) => setTemplates(prev => [tpl, ...prev]);

  const filtered = templates.filter(t => {
    if (filterStudio !== 'all' && t.studio_type !== filterStudio) return false;
    if (filterGenre !== 'all' && t.genre !== filterGenre) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) &&
        !t.prompt.toLowerCase().includes(search.toLowerCase()) &&
        !t.description?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const featured = filtered.filter(t => t.is_featured);
  const rest = filtered.filter(t => !t.is_featured);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="fixed top-0 inset-x-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50 px-6 h-14 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-semibold">Back</span>
        </Link>
        <div className="flex-1" />
        {user && (
          <Button onClick={() => setShowCreate(true)} size="sm"
            className="bg-purple-600 hover:bg-purple-500 rounded-xl gap-1.5 text-xs font-bold">
            <Plus className="w-3.5 h-3.5" /> Share Template
          </Button>
        )}
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden pt-20 pb-12 px-6 bg-gradient-to-br from-purple-900/30 to-black">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-5xl font-black text-white mb-3 tracking-tight">🎨 Community Templates</h1>
          <p className="text-white/60 text-lg">Discover and share prompts across Music, Lyrics, Cover Art & Video studios.</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search templates…" className="pl-9 rounded-xl" />
          </div>
          <Select value={filterStudio} onValueChange={setFilterStudio}>
            <SelectTrigger className="w-36 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Studios</SelectItem>
              <SelectItem value="music">🎵 Music</SelectItem>
              <SelectItem value="lyrics">📝 Lyrics</SelectItem>
              <SelectItem value="cover_art">🎨 Cover Art</SelectItem>
              <SelectItem value="video">🎬 Video</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterGenre} onValueChange={setFilterGenre}>
            <SelectTrigger className="w-36 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Genres</SelectItem>
              {GENRES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-border rounded-2xl">
            <Zap className="w-10 h-10 mx-auto text-muted-foreground mb-3 opacity-30" />
            <p className="text-muted-foreground font-medium mb-2">No templates found</p>
            {user && <Button onClick={() => setShowCreate(true)} className="bg-purple-600 hover:bg-purple-500 rounded-xl gap-2"><Plus className="w-4 h-4" /> Be the first to share!</Button>}
          </div>
        ) : (
          <>
            {featured.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-muted-foreground uppercase mb-4 flex items-center gap-2"><Star className="w-4 h-4 text-yellow-400" /> Featured</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {featured.map(t => (
                    <TemplateCard key={t.id} template={t} onUse={handleUse} onLike={handleLike}
                      isOwner={user?.id === t.user_id} onDelete={handleDelete} />
                  ))}
                </div>
              </div>
            )}
            <div>
              {featured.length > 0 && <h2 className="text-sm font-bold text-muted-foreground uppercase mb-4">Community Submissions</h2>}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rest.map(t => (
                  <TemplateCard key={t.id} template={t} onUse={handleUse} onLike={handleLike}
                    isOwner={user?.id === t.user_id} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {showCreate && user && (
          <CreateTemplateModal user={user} onClose={() => setShowCreate(false)} onCreated={handleCreated} />
        )}
      </AnimatePresence>
    </div>
  );
}