import { useState } from 'react';
import { Palette, Copy, Download, Share2, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const TEMPLATE_STYLES = [
  { value: 'modern_minimal', label: '✨ Modern Minimal', desc: 'Clean, typography-focused' },
  { value: 'vibrant_gradient', label: '🌈 Vibrant Gradient', desc: 'Bold, colorful, eye-catching' },
  { value: 'dark_moody', label: '🌙 Dark Moody', desc: 'Cinematic, premium feel' },
  { value: 'playful_bold', label: '🎨 Playful Bold', desc: 'Fun, energetic, Gen-Z vibes' },
  { value: 'sleek_premium', label: '💎 Sleek Premium', desc: 'Luxury, sophisticated' },
];

const PLATFORMS = [
  { key: 'instagram_post', label: '📸 Instagram Post', size: '1080×1080', desc: 'Feed post' },
  { key: 'instagram_story', label: '📱 Instagram Story', size: '1080×1920', desc: 'Full-screen story' },
  { key: 'twitter_card', label: '𝕏 Twitter/X Card', size: '1200×675', desc: 'Tweet card' },
  { key: 'facebook_cover', label: '👍 Facebook Cover', size: '820×312', desc: 'Profile cover' },
  { key: 'tiktok_thumbnail', label: '🎵 TikTok Thumbnail', size: '1080×1920', desc: 'Video thumbnail' },
  { key: 'pinterest_pin', label: '📌 Pinterest Pin', size: '1000×1500', desc: 'Tall pin format' },
  { key: 'linkedin_post', label: '💼 LinkedIn Post', size: '1200×627', desc: 'Feed post' },
];

const PRESET_COLORS = [
  '#FF1493', '#1E90FF', '#00CED1', '#FFD700', '#FF6347', '#9370DB', '#00FA9A', '#FF8C00',
];

export default function SocialCardDesigner({ card, onGenerate, generating }) {
  const [form, setForm] = useState(card || {
    artist_name: '',
    track_title: '',
    release_date: '',
    bio_snippet: '',
    genre: '',
    primary_color: '#1E90FF',
    template_style: 'modern_minimal',
    instagram_handle: '',
    tiktok_handle: '',
    twitter_handle: '',
  });

  const [selectedPlatforms, setSelectedPlatforms] = useState(['instagram_post', 'twitter_card', 'tiktok_thumbnail']);

  const togglePlatform = (key) => {
    setSelectedPlatforms(prev =>
      prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]
    );
  };

  const handleGenerate = () => {
    if (!form.artist_name.trim() || !form.track_title.trim()) {
      toast.error('Artist name and track title required');
      return;
    }
    onGenerate(form, selectedPlatforms);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left: Designer Controls */}
      <div className="lg:col-span-1 space-y-6">
        {/* Basic Info */}
        <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
          <h3 className="font-black text-foreground text-sm">Artist & Track</h3>
          <Input
            value={form.artist_name}
            onChange={e => setForm(f => ({ ...f, artist_name: e.target.value }))}
            placeholder="Artist name"
            className="rounded-xl text-sm"
          />
          <Input
            value={form.track_title}
            onChange={e => setForm(f => ({ ...f, track_title: e.target.value }))}
            placeholder="Track title"
            className="rounded-xl text-sm"
          />
          <Input
            type="date"
            value={form.release_date}
            onChange={e => setForm(f => ({ ...f, release_date: e.target.value }))}
            className="rounded-xl text-sm"
          />
          <Input
            value={form.bio_snippet}
            onChange={e => setForm(f => ({ ...f, bio_snippet: e.target.value }))}
            placeholder="Short tagline or bio"
            className="rounded-xl text-sm"
          />
        </div>

        {/* Social Handles */}
        <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
          <h3 className="font-black text-foreground text-sm">Social Handles</h3>
          <div className="space-y-2">
            <Input
              value={form.instagram_handle}
              onChange={e => setForm(f => ({ ...f, instagram_handle: e.target.value }))}
              placeholder="Instagram @handle"
              className="rounded-xl text-sm"
            />
            <Input
              value={form.tiktok_handle}
              onChange={e => setForm(f => ({ ...f, tiktok_handle: e.target.value }))}
              placeholder="TikTok @handle"
              className="rounded-xl text-sm"
            />
            <Input
              value={form.twitter_handle}
              onChange={e => setForm(f => ({ ...f, twitter_handle: e.target.value }))}
              placeholder="Twitter/X @handle"
              className="rounded-xl text-sm"
            />
          </div>
        </div>

        {/* Colors & Genre */}
        <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
          <h3 className="font-black text-foreground text-sm flex items-center gap-2">
            <Palette className="w-4 h-4" /> Brand Color
          </h3>
          <div className="flex gap-2 flex-wrap">
            {PRESET_COLORS.map(color => (
              <button
                key={color}
                onClick={() => setForm(f => ({ ...f, primary_color: color }))}
                className={`w-8 h-8 rounded-lg border-2 transition-all ${
                  form.primary_color === color ? 'border-white' : 'border-transparent opacity-60'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <Input
            type="color"
            value={form.primary_color}
            onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
            className="w-full rounded-xl h-10"
          />
          <Input
            value={form.genre}
            onChange={e => setForm(f => ({ ...f, genre: e.target.value }))}
            placeholder="Genre (e.g., Hip-Hop, EDM)"
            className="rounded-xl text-sm"
          />
        </div>

        {/* Template Style */}
        <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
          <h3 className="font-black text-foreground text-sm">Design Style</h3>
          <div className="space-y-2">
            {TEMPLATE_STYLES.map(style => (
              <button
                key={style.value}
                onClick={() => setForm(f => ({ ...f, template_style: style.value }))}
                className={`w-full text-left p-3 rounded-lg border transition-all text-sm ${
                  form.template_style === style.value
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-border hover:border-border/80'
                }`}
              >
                <p className="font-bold text-foreground">{style.label}</p>
                <p className="text-xs text-muted-foreground">{style.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Platform Selection & Preview */}
      <div className="lg:col-span-2 space-y-6">
        {/* Platform Selection */}
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <h3 className="font-black text-foreground flex items-center gap-2">
            <Share2 className="w-5 h-5" /> Select Platforms
          </h3>
          <p className="text-xs text-muted-foreground">Cards will be generated for each selected platform</p>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {PLATFORMS.map(platform => (
              <button
                key={platform.key}
                onClick={() => togglePlatform(platform.key)}
                className={`p-3 rounded-xl border text-left text-sm transition-all ${
                  selectedPlatforms.includes(platform.key)
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-border hover:border-border/80'
                }`}
              >
                <p className="font-bold text-foreground">{platform.label}</p>
                <p className="text-xs text-muted-foreground">{platform.size}</p>
                <p className="text-xs text-muted-foreground/60">{platform.desc}</p>
              </button>
            ))}
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generating || !form.artist_name || !form.track_title}
            className="w-full rounded-xl gap-2 bg-purple-600 hover:bg-purple-500 font-bold py-5 text-base"
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Generating Cards...
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" /> Generate {selectedPlatforms.length} Cards
              </>
            )}
          </Button>
        </div>

        {/* Info Box */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-5">
          <p className="text-sm text-blue-300">
            💡 <span className="font-semibold">Tip:</span> Each platform gets a custom-sized card optimized for its feed. Download all or share individual cards directly to social media.
          </p>
        </div>
      </div>
    </div>
  );
}