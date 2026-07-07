import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const TEMPLATES = [
  { value: 'dark_moody', label: 'Dark & Moody' },
  { value: 'vibrant_gradient', label: 'Vibrant Gradient' },
  { value: 'modern_minimal', label: 'Modern Minimal' },
  { value: 'playful_bold', label: 'Playful Bold' },
  { value: 'sleek_premium', label: 'Sleek Premium' },
];

const PLATFORMS = [
  { value: 'instagram_post', label: 'Instagram Post (1:1)' },
  { value: 'instagram_story', label: 'Instagram Story (9:16)' },
  { value: 'twitter_card', label: 'Twitter/X Card (16:9)' },
  { value: 'tiktok_thumbnail', label: 'TikTok Thumbnail (9:16)' },
];

export default function PromoCardOptions({ options, onChange }) {
  const set = (key, value) => onChange({ ...options, [key]: value });

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-bold text-muted-foreground mb-1 block">Card Style</label>
        <Select value={options.template_style} onValueChange={v => set('template_style', v)}>
          <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TEMPLATES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs font-bold text-muted-foreground mb-1 block">Platform</label>
        <Select value={options.platform} onValueChange={v => set('platform', v)}>
          <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PLATFORMS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs font-bold text-muted-foreground mb-1 block">Tagline (optional)</label>
        <Input value={options.tagline} onChange={e => set('tagline', e.target.value)}
          placeholder="e.g. The future of sound is here" className="rounded-xl" />
      </div>
      <div>
        <label className="text-xs font-bold text-muted-foreground mb-1 block">Accent Color</label>
        <div className="flex items-center gap-2">
          <input type="color" value={options.primary_color}
            onChange={e => set('primary_color', e.target.value)}
            className="w-9 h-9 rounded-lg border border-border bg-transparent cursor-pointer" />
          <span className="text-xs text-muted-foreground font-mono">{options.primary_color}</span>
        </div>
      </div>
    </div>
  );
}