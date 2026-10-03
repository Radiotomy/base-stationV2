import { useEffect, useRef, useState } from 'react';
import { Send, Loader2, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ArchitectMessage from './ArchitectMessage';

const STARTERS = [
  'Build me a neon electronic club called Midnight Signal',
  'A cozy acoustic room for my singer-songwriter sets',
  'Switch my venue to the jazz lounge look',
  'Make my venue public and turn on the in-world panel',
];

export default function ArchitectChat({ onToolsSettled, onBusyChange }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const endRef = useRef(null);
  const lastDone = useRef(0);

  useEffect(() => {
    base44.agents.createConversation({ agent_name: 'venueArchitect', metadata: { name: 'Venue Architect' } })
      .then(setConversation);
  }, []);

  useEffect(() => {
    if (!conversation?.id) return;
    return base44.agents.subscribeToConversation(conversation.id, (data) => setMessages(data.messages || []));
  }, [conversation?.id]);

  const calls = messages.flatMap((m) => m.tool_calls || []);
  const running = calls.some((t) => ['pending', 'running', 'in_progress'].includes(t.status));
  const done = calls.length - (running ? 1 : 0);
  const thinking = messages.length > 0 && messages[messages.length - 1].role === 'user';

  useEffect(() => { onBusyChange?.(running); }, [running]);
  useEffect(() => {
    if (!running && done > lastDone.current) { lastDone.current = done; onToolsSettled?.(); }
  }, [running, done]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || !conversation) return;
    setInput('');
    await base44.agents.addMessage(conversation, { role: 'user', content });
  };

  return (
    <div className="rack-unit flex flex-col h-full min-h-[480px]">
      <div className="rack-display mb-3">
        <span className="rack-readout text-xs flex items-center gap-2"><Sparkles className="w-3.5 h-3.5" /> Venue Architect</span>
        <span className={`rack-led ${conversation ? 'rack-led-on' : ''}`} />
      </div>
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Tell me the vibe of your show — genre, mood, a name — and I'll build your 3D venue.</p>
            {STARTERS.map((s) => (
              <button key={s} onClick={() => send(s)} disabled={!conversation}
                className="block w-full text-left merc-button-dark rounded-xl px-3 py-2 text-xs">{s}</button>
            ))}
          </div>
        )}
        {messages.map((m, i) => <ArchitectMessage key={i} message={m} />)}
        {thinking && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2 mt-3">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Describe your venue…"
          className="flex-1 rack-screen px-3 py-2 text-sm text-foreground outline-none" />
        <button type="submit" disabled={!conversation || !input.trim()}
          className="merc-button rounded-xl px-4 disabled:opacity-50"><Send className="w-4 h-4" /></button>
      </form>
    </div>
  );
}