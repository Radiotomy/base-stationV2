import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// clipId unlocks Sonic's real note transcription (POST /sonic/midi); without it the
// export is a tempo/key placeholder built server-side.
export default function MidiExportButton({ clipId, bpm, musicalKey, title, className = '' }) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await base44.functions.invoke('exportMidi', {
        clip_id: clipId || undefined,
        bpm: bpm || 120,
        key: musicalKey || 'C',
        title: title || 'Track',
      });
      const midiUrl = res.data?.midi_url;
      if (!midiUrl) throw new Error('No MIDI URL returned');

      // Trigger download
      const a = document.createElement('a');
      a.href = midiUrl;
      a.download = `${(title || 'track').replace(/\s+/g, '_')}.mid`;
      a.click();
      toast.success(res.data?.source === 'sonic' ? 'MIDI transcription downloaded!' : 'MIDI file downloaded (tempo/key sketch)');
    } catch (err) {
      toast.error('MIDI export failed: ' + err.message);
    }
    setExporting(false);
  };

  return (
    <Button
      onClick={handleExport}
      disabled={exporting}
      variant="outline"
      size="sm"
      className={`gap-1.5 rounded-xl text-xs text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10 ${className}`}
    >
      {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
      {exporting ? 'Exporting…' : 'MIDI'}
    </Button>
  );
}