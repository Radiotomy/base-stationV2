import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

/** Saves a full 243 Masters report (lyrics + chords + arrangement + brief) to the library. */
export default function SaveMastersReportButton({ brief, lyrics = '', genre = '', mood = '' }) {
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!brief) return;
    setSaving(true);
    try {
      const user = await base44.auth.me();
      const chords = (brief.chord_progression || [])
        .map(c => `${c.section}: ${c.nashville || ''} | ${c.roman || ''}${c.notes ? ` — ${c.notes}` : ''}`).join('\n');
      const arr = (brief.arrangement || [])
        .map(a => `${a.section}${a.dynamics ? ` (${a.dynamics})` : ''}: ${a.instrumentation || ''}${a.production_detail ? ` → ${a.production_detail}` : ''}`).join('\n');
      const mastersNames = (brief.masters_used || [])
        .map(m => (typeof m === 'string' ? m : m.name || m.n || '')).filter(Boolean).join(', ');
      const text = [
        '243 MASTERS ENGINE REPORT',
        `Title: ${brief.title || 'Untitled'}`,
        `Key: ${brief.key || '—'} · BPM: ${brief.bpm || '—'}`,
        mastersNames ? `Masters: ${mastersNames}` : '',
        '',
        '── LYRICS ──',
        lyrics || brief.lyrics || '',
        '',
        '── CHORD PROGRESSION ──',
        chords,
        '',
        '── ARRANGEMENT ──',
        arr,
        '',
        '── PRODUCTION BRIEF ──',
        brief.production_brief || '',
      ].join('\n');
      const file = new File([new Blob([text], { type: 'text/plain' })], `${brief.title || 'masters-report'}.txt`, { type: 'text/plain' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.UserAsset.create({
        user_id: user.id,
        user_email: user.email,
        asset_type: 'lyric',
        title: `👑 ${brief.title || 'Masters Report'}`,
        file_url,
        is_public: false,
        metadata: {
          masters_report: true,
          content: lyrics || brief.lyrics || '',
          genre, mood,
          masters_brief: brief.production_brief,
          masters_key: brief.key,
          masters_bpm: brief.bpm,
          masters_chord_progression: brief.chord_progression,
          masters_arrangement: brief.arrangement,
          masters_used: brief.masters_used,
        },
      });
      toast.success('👑 Full Masters report saved to library!');
    } catch (err) {
      toast.error('Save failed: ' + (err?.response?.data?.message || err?.response?.data?.error || err.message));
    }
    setSaving(false);
  };

  return (
    <Button onClick={save} disabled={saving} size="sm"
      className="rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold gap-1.5 text-xs">
      <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save Full Report'}
    </Button>
  );
}