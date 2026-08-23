import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Send, Loader2 } from 'lucide-react';
import MaestroAvatar from './MaestroAvatar';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import MaestroChatBubble from './MaestroChatBubble';
import MaestroDraftCard from './MaestroDraftCard';
import MaestroTrackCard from './MaestroTrackCard';
import { parseMaestroDraft } from '@/lib/music/maestroParse';

const OPENER = "I'm Maestro. Tell me what you're writing — genre, mood, the story, any artists you want it to feel like, and whether you want vocals. I'll pick the master synthesis combination and write it properly.";

const STARTERS = [
  'A late-night Americana ballad about leaving a small town — Stapleton meets Isbell, male vocal',
  'Euphoric summer pop anthem, female vocal, big singalong chorus',
  'Moody trap-soul about second chances, half-time feel, male vocal',
];

// Conversational Maestro session — concept through generation. Every turn goes
// through the maestroChatProxy so the agent key stays server-side.
export default function MaestroChatPanel() {
  const [conversationId, setConversationId] = useState('');
  const [messages, setMessages] = useState([{ role: 'assistant', text: OPENER }]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [draft, setDraft] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [jobId, setJobId] = useState('');
  const [trackStatus, setTrackStatus] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [jobError, setJobError] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking]);

  // Poll the committed track until it lands
  useEffect(() => {
    if (!jobId || audioUrl) return;
    const timer = setInterval(async () => {
      const job = await base44.entities.GenerationJob.get(jobId);
      if (job.status === 'completed') {
        setAudioUrl(job.output_url || job.output_metadata?.audio_url || '');
        setTrackStatus('completed');
      } else if (job.status === 'failed') {
        setJobError(job.error_message || 'Generation failed.');
      }
    }, 8000);
    return () => clearInterval(timer);
  }, [jobId, audioUrl]);

  const send = async (text) => {
    const message = (text ?? input).trim();
    if (!message || thinking) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: message }]);
    setThinking(true);
    try {
      let convo = conversationId;
      if (!convo) {
        const started = await base44.functions.invoke('maestroChatProxy', { action: 'start' });
        convo = started.data?.conversation_id;
        setConversationId(convo);
      }
      const res = await base44.functions.invoke('maestroChatProxy', {
        action: 'send',
        conversation_id: convo,
        message,
      });
      const reply = res.data?.reply || "I didn't catch that — say it again?";
      setMessages(prev => [...prev, { role: 'assistant', text: reply }]);
      const parsed = parseMaestroDraft(reply);
      if (parsed) setDraft(parsed);
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || 'Maestro is unreachable right now.');
    }
    setThinking(false);
  };

  const generate = async () => {
    if (!draft) return;
    setGenerating(true);
    setJobError('');
    try {
      const res = await base44.functions.invoke('maestroChatProxy', {
        action: 'generate',
        title: draft.title,
        lyrics: draft.lyrics,
        sound_prompt: draft.sound_prompt,
      });
      if (res.data?.job_id) {
        setJobId(res.data.job_id);
        setTrackStatus('processing');
      } else if (res.data?.audio_url || res.data?.output_url) {
        setAudioUrl(res.data.audio_url || res.data.output_url);
        setTrackStatus('completed');
      }
      setMessages(prev => [...prev, { role: 'assistant', text: 'Sent to the studio — composing now. I\'ll keep the session open if you want to work up another version.' }]);
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || 'Could not start generation.');
    }
    setGenerating(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MaestroAvatar size={48} />
        <p className="text-sm font-black text-foreground">Maestro Session</p>
        <span className="text-xs text-muted-foreground">12 master combinations · full craft treatment</span>
      </div>

      <div ref={scrollRef} className="h-[26rem] overflow-y-auto rounded-2xl border border-border bg-card p-4 space-y-3">
        {messages.map((m, i) => <MaestroChatBubble key={i} role={m.role} text={m.text} />)}
        {thinking && (
          <div className="flex items-center gap-2 text-xs text-amber-300">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Maestro is working the craft…
          </div>
        )}
      </div>

      {messages.length === 1 && (
        <div className="space-y-1.5">
          {STARTERS.map(s => (
            <button key={s} onClick={() => send(s)}
              className="w-full text-left px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted text-xs text-muted-foreground transition-colors truncate">
              "{s}"
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Tell Maestro what you want — or ask for changes…"
          className="flex-1 rounded-xl border border-input bg-transparent px-4 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <Button onClick={() => send()} disabled={thinking || !input.trim()} className="rounded-xl px-4 gap-2 font-bold">
          <Send className="w-4 h-4" />
        </Button>
      </div>

      <MaestroDraftCard draft={draft} onGenerate={generate} generating={generating} />
      <MaestroTrackCard status={trackStatus} audioUrl={audioUrl} title={draft?.title} error={jobError} />
    </div>
  );
}