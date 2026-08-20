import React, { useState } from 'react';
import { Sparkles, Loader2, CornerDownLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const EXAMPLES = [
  'Warm analog tape saturation with slow pitch flutter',
  'Dub delay that ducks the low end on each repeat',
  'Bandpass sweep synced to 1/8 notes',
  'Hollow metallic drone from two detuned saws',
];

// Conversational DSP architect. Every turn is kept: a prompt history is how you
// retrace why a patch sounds the way it does.
export default function AssistantPane({ history, busy, onSubmit }) {
  const [prompt, setPrompt] = useState('');

  const submit = () => {
    const text = prompt.trim();
    if (!text || busy) return;
    setPrompt('');
    onSubmit(text);
  };

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-3.5 h-3.5 text-[#FF9A4D]" />
        <span className="text-[11px] uppercase tracking-widest text-white/50">DSP Architect</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
        {!history.length && (
          <div className="space-y-2">
            <p className="text-[11px] text-white/40 leading-relaxed">
              Describe the sound you want. The architect designs the module chain, and you
              keep full control of it on the canvas.
            </p>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setPrompt(ex)}
                className="w-full text-left text-[11px] text-white/55 hover:text-[#FFC98A] px-2.5 py-2 rounded-lg bg-white/4 border border-white/8 transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        {history.map((turn, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex items-start gap-1.5">
              <CornerDownLeft className="w-3 h-3 mt-0.5 text-white/25 shrink-0" />
              <p className="text-[11px] text-white/75 leading-snug">{turn.prompt}</p>
            </div>
            <div
              className="rounded-lg px-2.5 py-2 text-[11px] leading-snug"
              style={{
                background: turn.error ? 'rgba(255,107,74,0.10)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${turn.error ? 'rgba(255,107,74,0.25)' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              <p className={turn.error ? 'text-[#FF9A8A]' : 'text-white/60'}>
                {turn.error || turn.summary}
              </p>
              {!turn.error && turn.node_count != null && (
                <p className="mt-1 text-[9px] font-mono text-white/30">
                  {turn.node_count} modules · {turn.edge_count} cables
                </p>
              )}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex items-center gap-2 text-[11px] text-white/45">
            <Loader2 className="w-3 h-3 animate-spin" />
            Designing the signal chain…
          </div>
        )}
      </div>

      <div className="pt-2 mt-2 border-t border-white/8">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
          }}
          placeholder="Describe a sound, or ask for a change to the current patch…"
          rows={2}
          className="text-xs bg-white/5 border-white/10 resize-none mb-2"
        />
        <Button onClick={submit} disabled={busy || !prompt.trim()} className="w-full h-8 text-xs merc-button">
          {busy ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1.5" />}
          Generate patch
        </Button>
      </div>
    </div>
  );
}