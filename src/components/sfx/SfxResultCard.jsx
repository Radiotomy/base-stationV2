import { useState } from 'react';
import { CheckCircle, Save, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function SfxResultCard({ audioUrl, prompt, params, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const saveToLibrary = async () => {
    setSaving(true);
    try {
      const user = await base44.auth.me();
      await base44.entities.UserAsset.create({
        user_id: user.id,
        user_email: user.email,
        asset_type: 'sfx',
        title: prompt.slice(0, 60) || 'Sound Effect',
        file_url: audioUrl,
        is_public: false,
        metadata: {
          provider: 'elevenlabs',
          model: 'eleven_text_to_sound_v2',
          prompt,
          duration_seconds: params?.duration_seconds || null,
          loop: !!params?.loop,
          prompt_influence: params?.prompt_influence,
          ai_assisted: true,
        },
      });
      setSaved(true);
      onSaved?.();
      toast.success('Sound effect saved to library!');
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message);
    }
    setSaving(false);
  };

  return (
    <div className="bg-card rounded-2xl border border-emerald-500/30 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <CheckCircle className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-bold text-emerald-400">Sound Effect Ready</span>
      </div>
      <p className="text-xs text-muted-foreground italic truncate">"{prompt}"</p>
      <audio controls className="w-full rounded-xl" src={audioUrl} loop={!!params?.loop} />
      <div className="flex gap-2">
        <Button onClick={saveToLibrary} disabled={saving || saved}
          className="flex-1 gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold">
          <Save className="w-4 h-4" /> {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save to Library'}
        </Button>
        <a href={audioUrl} download className="flex-1">
          <Button variant="outline" className="w-full gap-2 rounded-xl">
            <Download className="w-4 h-4" /> Download
          </Button>
        </a>
      </div>
    </div>
  );
}