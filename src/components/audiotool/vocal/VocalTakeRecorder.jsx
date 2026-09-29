import { useRef, useState } from 'react';
import { Mic, Square, Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';
import SendToAudiotoolButton from '@/components/audiotool/songstarter/SendToAudiotoolButton';
import { loadAsWavFile } from '@/lib/audiotool/localAudio';
import InfoTip from '@/components/common/InfoTip';
import TIPS from '@/lib/audiotool/bridgeTips';

/** Record or import a vocal take and place it on the timeline. Human-made — no telemetry. */
export default function VocalTakeRecorder() {
  const [recording, setRecording] = useState(false);
  const [take, setTake] = useState(null);
  const [error, setError] = useState('');
  const recorder = useRef(null);

  const start = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: mr.mimeType });
        setTake({ url: URL.createObjectURL(blob), name: `Vocal take ${new Date().toLocaleTimeString()}` });
      };
      mr.start();
      recorder.current = mr;
      setRecording(true);
    } catch (e) { setError(`Microphone unavailable — ${e.message}`); }
  };

  const stop = () => { recorder.current?.stop(); setRecording(false); };
  const pick = (e) => {
    const f = e.target.files?.[0];
    if (f) setTake({ url: URL.createObjectURL(f), name: f.name.replace(/\.[^.]+$/, '') });
  };

  return (
    <section className="rack-unit !pt-8 space-y-4">
      <div>
        <h3 className="font-bold flex items-center gap-2"><Mic className="w-4 h-4 text-accent" /> Vocal Take <InfoTip text={TIPS.vocalTake} /></h3>
        <p className="text-sm text-muted-foreground">Sing it in or bring a file — your take becomes an audio region on the timeline.</p>
      </div>
      <div className="flex items-center gap-4">
        <button type="button" onClick={recording ? stop : start} aria-label={recording ? 'Stop recording' : 'Record'}
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all active:scale-95 ${recording ? 'bg-destructive animate-pulse' : 'merc-button'}`}>
          {recording ? <Square className="w-7 h-7 text-destructive-foreground" /> : <Mic className="w-8 h-8" />}
        </button>
        <div className="text-sm">
          <p className="font-semibold">{recording ? 'Recording…' : 'Tap to record'}</p>
          <label className="text-accent inline-flex items-center gap-1 cursor-pointer hover:underline mt-1">
            <Upload className="w-3.5 h-3.5" /> or import a file
            <input type="file" accept="audio/*" className="hidden" onChange={pick} />
          </label>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {take && (
        <div className="rounded-2xl bg-secondary/50 p-3 space-y-2">
          <Input value={take.name} onChange={(e) => setTake({ ...take, name: e.target.value })} aria-label="Take name" />
          <audio src={take.url} controls className="w-full h-9" />
          <SendToAudiotoolButton getFile={() => loadAsWavFile(take.url, take.name)} name={take.name} label="Place take on timeline" />
        </div>
      )}
    </section>
  );
}