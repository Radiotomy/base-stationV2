import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Wand2, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import VoiceProviderPicker from '@/components/studios/orvo/studio/VoiceProviderPicker';
import EmotionTagPicker from '@/components/studios/orvo/studio/EmotionTagPicker';

export default function VoiceoverStudio() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [provider, setProvider] = useState('inworld');
  const [voiceId, setVoiceId] = useState('Ashley');
  const [inworldMode, setInworldMode] = useState('tts');
  const [tags, setTags] = useState([]);
  const [busy, setBusy] = useState(false);
  const [assets, setAssets] = useState([]);

  useEffect(() => {
    if (!user) return;
    base44.entities.OrvoPodcastAsset
      .filter({ user_id: user.id, asset_type: 'voiceover' }, '-created_date', 20)
      .then(setAssets);
  }, [user]);

  const toggleTag = (tag) =>
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));

  const generate = async () => {
    if (!text.trim()) return;
    setBusy(true);
    const res = await base44.functions.invoke('generateVoiceover', {
      text: text.trim(),
      title: title.trim() || undefined,
      provider,
      voice_id: voiceId,
      inworld_mode: provider === 'inworld' ? inworldMode : undefined,
      emotion_tags: tags,
    }).catch((e) => ({ data: { error: e.message } }));
    setBusy(false);

    const data = res?.data || {};
    if (data.error) {
      toast({ title: 'Voiceover failed', description: data.error, variant: 'destructive' });
      return;
    }
    toast({ title: 'Voiceover ready', description: 'Saved to your ORVO assets.' });
    if (data.script) setText(data.script);
    const rows = await base44.entities.OrvoPodcastAsset
      .filter({ user_id: user.id, asset_type: 'voiceover' }, '-created_date', 20);
    setAssets(rows);
  };

  return (
    <div className="min-h-screen pb-16 pt-16 px-6" style={{ backgroundColor: '#14100C' }}>
      <div className="max-w-4xl mx-auto space-y-6">
        <Link to="/studios/orvo" className="text-sm text-white/50 hover:text-white flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" /> ORVO Studio
        </Link>

        <div>
          <h1 className="font-display text-3xl text-white">AI Voiceover</h1>
          <p className="text-white/60 text-sm mt-1">
            Write a line or a brief — Inworld TTS-2 voices it, or drafts the script first and then voices it.
          </p>
        </div>

        <div className="merc-card rounded-xl p-4 space-y-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Segment title (optional)" />
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            maxLength={5000}
            placeholder={
              inworldMode === 'llm_plus_tts' && provider === 'inworld'
                ? 'Describe the segment — e.g. "A 30-second intro welcoming listeners to episode 12 about AI in music."'
                : 'The exact words to speak…'
            }
          />
          <p className="text-[11px] text-white/40">{text.length}/5000</p>
        </div>

        <VoiceProviderPicker
          provider={provider}
          onProviderChange={setProvider}
          voiceId={voiceId}
          onVoiceIdChange={setVoiceId}
          inworldMode={inworldMode}
          onInworldModeChange={setInworldMode}
          disabled={busy}
        />

        {provider === 'inworld' && (
          <EmotionTagPicker selected={tags} onToggle={toggleTag} disabled={busy} />
        )}

        <button
          onClick={generate}
          disabled={busy || !text.trim()}
          className="merc-button rounded-full px-6 py-2.5 text-sm font-black flex items-center gap-2 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          {busy ? 'Generating…' : 'Generate Voiceover'}
        </button>

        <section>
          <h2 className="font-display text-xl text-white mb-3">Recent Voiceovers</h2>
          {assets.length === 0 ? (
            <p className="text-white/40 text-sm">Nothing generated yet.</p>
          ) : (
            <div className="space-y-3">
              {assets.map((a) => (
                <div key={a.id} className="merc-card rounded-xl p-4">
                  <p className="text-sm font-bold text-white truncate">{a.title}</p>
                  <p className="text-[11px] text-white/40 mb-2">
                    {a.metadata?.provider || 'unknown'} · {a.metadata?.voice_id || '—'}
                  </p>
                  <audio controls src={a.file_url} className="w-full" />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}