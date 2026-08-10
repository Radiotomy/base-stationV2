import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

const field = 'w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF9A4D]/60';

export default function ScheduleEventForm({ podcasts, onScheduled }) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [podcastId, setPodcastId] = useState(podcasts[0]?.id || '');
  const [scheduledAt, setScheduledAt] = useState('');
  const [aiHosted, setAiHosted] = useState(true);
  const [mediaType, setMediaType] = useState('audio');
  const [streamUrl, setStreamUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim() || !podcastId) {
      toast({ title: 'Title and show are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const created = await base44.entities.OrvoLiveEvent.create({
        host_id: (await base44.auth.me()).id,
        podcast_id: podcastId,
        title: title.trim(),
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : new Date().toISOString(),
        is_ai_hosted: aiHosted,
        media_type: mediaType,
        stream_url: streamUrl.trim() || undefined,
        status: 'scheduled',
      });
      setTitle('');
      setScheduledAt('');
      onScheduled?.(created);
    } catch (e) {
      toast({ title: 'Could not schedule', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <div className="merc-card rounded-2xl p-5 space-y-3">
      <p className="text-xs font-bold uppercase tracking-widest text-[#FF9A4D]">Schedule a live session</p>
      <input className={field} placeholder="Episode title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <select className={field} value={podcastId} onChange={(e) => setPodcastId(e.target.value)}>
        {podcasts.map((p) => <option key={p.id} value={p.id} className="bg-[#14100C]">{p.title}</option>)}
      </select>
      <input type="datetime-local" className={field} value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
      <div className="flex gap-2">
        {['audio', 'video'].map((m) => (
          <button
            key={m}
            onClick={() => setMediaType(m)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border capitalize ${
              mediaType === m
                ? 'text-[#2A1508] border-black bg-gradient-to-b from-[#FFC26E] to-[#FF9A4D]'
                : 'text-white/55 border-white/10 bg-black/30'
            }`}
          >
            {m} broadcast
          </button>
        ))}
      </div>
      <input
        className={field}
        placeholder="Live stream link (YouTube, Twitch, Vimeo or direct URL) — optional"
        value={streamUrl}
        onChange={(e) => setStreamUrl(e.target.value)}
      />
      <label className="flex items-center gap-2 text-sm text-white/60">
        <input type="checkbox" checked={aiHosted} onChange={(e) => setAiHosted(e.target.checked)} />
        Enable AI co-host
      </label>
      <button onClick={submit} disabled={saving} className="merc-button rounded-full px-5 py-2 text-sm font-black disabled:opacity-50">
        {saving ? 'Scheduling…' : 'Schedule'}
      </button>
    </div>
  );
}