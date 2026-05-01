import { useState } from 'react';
import { Download, Copy, Share2, Image, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const PLATFORM_INFO = {
  instagram_post:     { label: '📸 Instagram Post', size: '1080×1080' },
  instagram_story:    { label: '📱 Instagram Story', size: '1080×1920' },
  twitter_card:       { label: '𝕏 Twitter Card', size: '1200×675' },
  facebook_cover:     { label: '👍 Facebook Cover', size: '820×312' },
  tiktok_thumbnail:   { label: '🎵 TikTok Thumbnail', size: '1080×1920' },
  pinterest_pin:      { label: '📌 Pinterest Pin', size: '1000×1500' },
  linkedin_post:      { label: '💼 LinkedIn Post', size: '1200×627' },
};

export default function SocialCardGallery({ card, loading }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="w-8 h-8 mx-auto mb-3 text-purple-400 animate-spin" />
          <p className="text-muted-foreground">Generating your social cards...</p>
        </div>
      </div>
    );
  }

  if (!card?.generated_cards || Object.keys(card.generated_cards).filter(k => card.generated_cards[k]).length === 0) {
    return (
      <div className="text-center py-20 border border-dashed border-border rounded-2xl">
        <Image className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
        <p className="text-muted-foreground">No cards generated yet — customize and click "Generate"</p>
      </div>
    );
  }

  const generatedCards = Object.entries(card.generated_cards)
    .filter(([_, url]) => url)
    .map(([key, url]) => ({ key, url, ...PLATFORM_INFO[key] }));

  const handleCopyUrl = (url) => {
    navigator.clipboard.writeText(url);
    toast.success('URL copied to clipboard!');
  };

  const handleDownload = async (url, name) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${name}.png`;
      a.click();
      toast.success('Downloaded!');
    } catch (err) {
      toast.error('Download failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-black text-foreground">Generated Cards</h3>
        <Badge className="bg-emerald-500/20 text-emerald-400 border-0">
          {generatedCards.length} platform{generatedCards.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {generatedCards.map(({ key, url, label, size }) => (
          <div key={key} className="bg-card rounded-2xl border border-border overflow-hidden group">
            {/* Preview */}
            <div className="relative aspect-square md:aspect-video bg-muted overflow-hidden">
              <img src={url} alt={label} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
            </div>

            {/* Info */}
            <div className="p-4 space-y-3">
              <div>
                <p className="font-black text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{size}</p>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  onClick={() => handleCopyUrl(url)}
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-lg gap-1.5 text-xs"
                >
                  <Copy className="w-3 h-3" /> Copy Link
                </Button>
                <Button
                  onClick={() => handleDownload(url, `${card.artist_name}-${key}`)}
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-lg gap-1.5 text-xs"
                >
                  <Download className="w-3 h-3" /> Download
                </Button>
              </div>

              {/* Share Buttons */}
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">Quick share:</p>
                <div className="flex gap-2 flex-wrap">
                  {key.includes('instagram') && (
                    <a href={`https://instagram.com`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-pink-500/10 text-pink-400 text-xs hover:bg-pink-500/20 transition-colors">
                      📸 Instagram
                    </a>
                  )}
                  {key.includes('twitter') && (
                    <a href={`https://twitter.com`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 text-xs hover:bg-blue-500/20 transition-colors">
                      𝕏 Twitter
                    </a>
                  )}
                  {key.includes('tiktok') && (
                    <a href={`https://tiktok.com`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-black/30 text-white text-xs hover:bg-black/50 transition-colors">
                      🎵 TikTok
                    </a>
                  )}
                  {key.includes('facebook') && (
                    <a href={`https://facebook.com`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-600/20 text-blue-300 text-xs hover:bg-blue-600/40 transition-colors">
                      👍 Facebook
                    </a>
                  )}
                  {key.includes('pinterest') && (
                    <a href={`https://pinterest.com`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20 transition-colors">
                      📌 Pinterest
                    </a>
                  )}
                  {key.includes('linkedin') && (
                    <a href={`https://linkedin.com`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 text-xs hover:bg-cyan-500/20 transition-colors">
                      💼 LinkedIn
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}