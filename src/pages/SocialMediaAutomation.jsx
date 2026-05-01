import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Plus, History, Edit2, Trash2, CheckCircle, ArrowLeft, Loader2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import SocialCardDesigner from '@/components/social/SocialCardDesigner';
import SocialCardGallery from '@/components/social/SocialCardGallery';

export default function SocialMediaAutomation() {
  const [user, setUser] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('create');
  const [currentCard, setCurrentCard] = useState(null);
  const [generating, setGenerating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then(u => {
      if (!u) { navigate('/'); return; }
      setUser(u);
      base44.entities.SocialMediaCard.filter({ user_id: u.id }, '-created_date', 50)
        .then(setCards)
        .finally(() => setLoading(false));
    }).catch(() => navigate('/'));
  }, [navigate]);

  const handleGenerate = async (form, selectedPlatforms) => {
    setGenerating(true);
    try {
      const res = await base44.functions.invoke('generateSocialCard', {
        artist_name: form.artist_name,
        track_title: form.track_title,
        bio_snippet: form.bio_snippet,
        genre: form.genre,
        primary_color: form.primary_color,
        template_style: form.template_style,
        release_date: form.release_date,
        platforms: selectedPlatforms,
      });

      // Save to database
      const cardData = {
        user_id: user.id,
        user_email: user.email,
        ...form,
        generated_cards: res.data.generated_cards,
        is_public: false,
      };

      let savedCard;
      if (currentCard) {
        await base44.entities.SocialMediaCard.update(currentCard.id, cardData);
        setCards(cards.map(c => c.id === currentCard.id ? { ...c, ...cardData } : c));
        toast.success('Cards updated!');
      } else {
        savedCard = await base44.entities.SocialMediaCard.create(cardData);
        setCards([savedCard, ...cards]);
        setCurrentCard(savedCard);
        toast.success('Cards generated & saved!');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this card set?')) return;
    await base44.entities.SocialMediaCard.delete(id);
    setCards(cards.filter(c => c.id !== id));
    if (currentCard?.id === id) setCurrentCard(null);
    toast.success('Deleted');
  };

  const handleEdit = (card) => {
    setCurrentCard(card);
    setActiveTab('create');
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 mx-auto mb-3 text-purple-400 animate-spin" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50 px-6 h-14 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-semibold">Back</span>
        </Link>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-pink-900/30 to-purple-900/30 pt-20 pb-12 px-6 border-b border-border">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-5xl font-black text-white mb-3 tracking-tight">📱 Social Media Automation</h1>
            <p className="text-white/60 text-lg">Create custom-designed place cards for every platform. Promote your tracks and build your brand.</p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-border">
          {[
            { key: 'create', label: '✨ Create New', icon: Plus },
            { key: 'history', label: `📚 Card Sets (${cards.length})`, icon: History },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => { setActiveTab(key); if (key === 'history') setCurrentCard(null); }}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all ${activeTab === key ? 'border-purple-500 text-purple-400' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Create Tab */}
        {activeTab === 'create' && (
          <div className="space-y-10">
            <SocialCardDesigner
              card={currentCard}
              onGenerate={handleGenerate}
              generating={generating}
            />
            {currentCard && <SocialCardGallery card={currentCard} loading={generating} />}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            {cards.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-border rounded-2xl">
                <Share2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
                <p className="text-muted-foreground font-medium mb-2">No card sets yet</p>
                <p className="text-xs text-muted-foreground mb-4">Create your first social media card set</p>
                <Button onClick={() => setActiveTab('create')} className="rounded-xl gap-2 bg-purple-600 hover:bg-purple-500">
                  <Plus className="w-4 h-4" /> Create First Set
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {cards.map((card, i) => (
                  <motion.div key={card.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className="p-5 rounded-2xl bg-card border border-border hover:border-purple-500/30 transition-all flex items-start gap-4 group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-black text-foreground truncate">{card.artist_name} — {card.track_title}</h3>
                        <Badge className={`${card.generated_cards && Object.values(card.generated_cards).filter(Boolean).length > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'} border-0 text-xs flex-shrink-0`}>
                          {card.generated_cards ? `${Object.values(card.generated_cards).filter(Boolean).length} cards` : 'No cards'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {card.genre && <span>{card.genre}</span>}
                        {card.release_date && <span>{new Date(card.release_date).toLocaleDateString()}</span>}
                        {card.template_style && <span className="capitalize">{card.template_style.replace(/_/g, ' ')}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <Button onClick={() => handleEdit(card)} size="icon" variant="ghost" className="h-8 w-8 rounded-lg">
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button onClick={() => handleDelete(card.id)} size="icon" variant="ghost"
                        className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-16 p-6 rounded-2xl bg-purple-500/10 border border-purple-500/20">
          <h4 className="font-black text-foreground mb-2 flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-400" /> How It Works
          </h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>✓ Customize your card design with artist info, track details, and branding</li>
            <li>✓ Select platforms (Instagram, TikTok, Twitter, Facebook, Pinterest, LinkedIn, etc.)</li>
            <li>✓ AI generates custom-optimized cards for each platform's unique dimensions</li>
            <li>✓ Download, copy links, or share directly to your social channels</li>
            <li>✓ Save all card sets to your library for future releases</li>
          </ul>
        </div>
      </div>
    </div>
  );
}