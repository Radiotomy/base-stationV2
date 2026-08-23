import { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Wand2, Mic, Radio, Square, Bot } from 'lucide-react';
import AiCastEditor from './AiCastEditor';
import ScriptReviewList from './ScriptReviewList';
import { DEFAULT_CAST, AUTOPILOT_LABELS } from '@/lib/studios/orvo/aiCast';

/**
 * Host-only director for a fully AI-performed episode:
 * brief + cast -> script -> voice every segment -> put it on air.
 *
 * Rendering runs as a loop of small batches because a whole show is more TTS
 * round trips than one request can hold — the creator watches it fill instead of
 * waiting on a single opaque call.
 */
export default function AutopilotConsole({ event, onChange }) {
  const { toast } = useToast();
  const [topic, setTopic] = useState(event.topic || '');
  const [cast, setCast] = useState(event.ai_cast?.length ? event.ai_cast : DEFAULT_CAST);
  const [segmentCount, setSegmentCount] = useState(8);
  const [busy, setBusy] = useState('');
  const [progress, setProgress] = useState(null);

  const script = event.ai_script || [];
  const status = event.autopilot_status || 'idle';
  const rendered = script.filter((s) => s.audio_url).length;
  const runtime = script.reduce((n, s) => n + (s.seconds || 0), 0);

  const fail = (e) => toast({ title: 'Autopilot error', description: e.message, variant: 'destructive' });

  const generate = async () => {
    if (!topic.trim()) return;
    setBusy('script');
    try {
      const { data } = await base44.functions.invoke('orvoGenerateAiShow', {
        event_id: event.id,
        topic: topic.trim(),
        cast,
        segment_count: segmentCount,
      });
      if (data.error) throw new Error(data.error);
      onChange(data.event);
      toast({ title: 'Script ready', description: `${data.segment_count} segments — review before voicing.` });
    } catch (e) { fail(e); }
    setBusy('');
  };

  const render = async () => {
    setBusy('render');
    try {
      let remaining = 1;
      let guard = 0;
      while (remaining > 0 && guard < 30) {
        const { data } = await base44.functions.invoke('orvoRenderAiShow', { event_id: event.id });
        if (data.error) throw new Error(data.error);
        remaining = data.remaining;
        onChange(data.event);
        setProgress({ rendered: data.rendered, remaining, failed: data.failed });
        guard += 1;
      }
      toast({ title: 'Cast recorded', description: 'Every segment is voiced — the show can go on air.' });
    } catch (e) { fail(e); }
    setBusy('');
    setProgress(null);
  };

  const air = async (action) => {
    setBusy('air');
    try {
      const { data } = await base44.functions.invoke('orvoLiveEvent', { event_id: event.id, action });
      if (data.error) throw new Error(data.error);
      onChange(data.event);
    } catch (e) { fail(e); }
    setBusy('');
  };

  const editSegment = (index, text) => {
    // Editing a voiced line invalidates its recording — the audio no longer
    // matches the words, so it goes back to pending rather than airing a stale take.
    const next = script.map((s) => (s.index === index ? { ...s, text, audio_url: '', status: 'pending' } : s));
    onChange({ ...event, ai_script: next, autopilot_status: 'scripted' });
    base44.entities.OrvoLiveEvent.update(event.id, { ai_script: next, autopilot_status: 'scripted' }).catch(() => {});
  };

  const locked = status === 'running' || !!busy;

  return (
    <div className="merc-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs font-bold uppercase tracking-widest text-[#FF9A4D] flex items-center gap-1.5">
          <Bot className="w-3.5 h-3.5" /> AI cast autopilot
        </p>
        <span className="text-[11px] font-bold text-white/50">
          {AUTOPILOT_LABELS[status]}
          {script.length > 0 && ` · ${rendered}/${script.length} voiced · ${Math.round(runtime / 60)} min`}
        </span>
      </div>

      {event.autopilot_error && <p className="text-xs text-red-300">{event.autopilot_error}</p>}

      {status !== 'running' && status !== 'done' && (
        <>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="What is this episode about? e.g. 'Why AI stems changed the remix workflow — practical, sceptical, two voices.'"
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF9A4D]/60"
            disabled={locked}
          />

          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-xs text-white/50 flex items-center gap-2">
              Segments
              <input
                type="number"
                min={3}
                max={20}
                value={segmentCount}
                onChange={(e) => setSegmentCount(Number(e.target.value))}
                disabled={locked}
                className="w-16 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
              />
            </label>
            <button
              onClick={generate}
              disabled={locked || !topic.trim()}
              className="merc-button rounded-full px-5 py-2 text-sm font-black flex items-center gap-2 disabled:opacity-50"
            >
              {busy === 'script' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              {script.length > 0 ? 'Rewrite script' : 'Write the script'}
            </button>
          </div>

          <AiCastEditor cast={cast} onChange={setCast} disabled={locked} />
        </>
      )}

      {script.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-white/40">Running order</p>
          <ScriptReviewList
            script={script}
            cast={event.ai_cast || cast}
            onEditSegment={editSegment}
            editable={status !== 'running' && status !== 'done'}
          />
        </div>
      )}

      {progress && (
        <p className="text-xs text-white/50">
          Voicing… {progress.rendered} done, {progress.remaining} to go
          {progress.failed > 0 && ` · ${progress.failed} failed`}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {script.length > 0 && rendered < script.length && status !== 'running' && (
          <button
            onClick={render}
            disabled={locked}
            className="merc-button rounded-full px-5 py-2 text-sm font-black flex items-center gap-2 disabled:opacity-50"
          >
            {busy === 'render' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
            Voice the cast
          </button>
        )}

        {rendered > 0 && status !== 'running' && status !== 'done' && (
          <button
            onClick={() => air('autopilot_start')}
            disabled={locked}
            className="merc-button rounded-full px-5 py-2 text-sm font-black flex items-center gap-2 disabled:opacity-50"
          >
            {busy === 'air' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
            Go on air
          </button>
        )}

        {status === 'running' && (
          <button
            onClick={() => air('autopilot_stop')}
            disabled={!!busy}
            className="merc-button-dark rounded-full px-5 py-2 text-sm font-black flex items-center gap-2 disabled:opacity-50"
          >
            <Square className="w-4 h-4" /> Stop the show
          </button>
        )}

        {status === 'done' && event.archived_episode_id && (
          <Link
            to={`/studios/orvo/episode/${event.archived_episode_id}`}
            className="merc-button rounded-full px-5 py-2 text-sm font-black"
          >
            Open published episode
          </Link>
        )}
      </div>

      <p className="text-[11px] text-white/35 leading-relaxed">
        The whole cast is voiced before going on air, then each segment airs on schedule and the finished
        show is published to your podcast automatically — labelled AI-generated, with no human performance claimed.
      </p>
    </div>
  );
}