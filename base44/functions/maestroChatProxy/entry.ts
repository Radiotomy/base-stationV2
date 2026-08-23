import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

// Server-side bridge to the Song Maestro Superagent's Agent API.
// The API key authenticates BASE Station to another app's agent, so it can
// never reach the browser — every chat turn goes through here.
const AGENT_ID = '6a303beaf2f8e58c59380878';
const AGENT_BASE = `https://app.base44.com/api/agents/${AGENT_ID}`;

const agentFetch = async (path, { method = 'GET', body } = {}) => {
  const res = await fetch(`${AGENT_BASE}${path}`, {
    method,
    headers: {
      'api_key': secrets.get('MAESTRO_API_KEY'),
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) {
    throw new Error(`Maestro API error ${res.status}: ${text?.slice(0, 400) || ''}`);
  }
  return data;
};

// The Agent API can report the reply in several shapes depending on whether the
// turn finished inline or came back as a message list — pull the assistant text
// out of whichever one arrived.
const extractReply = (data) => {
  if (!data) return '';
  if (typeof data === 'string') return data;
  const candidates = [data.message, data.content, data.reply, data.response, data.text];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c;
    if (c && typeof c.content === 'string' && c.content.trim()) return c.content;
  }
  const list = data.messages || data.conversation?.messages;
  if (Array.isArray(list)) {
    const assistant = [...list].reverse().find(m => m?.role !== 'user' && (m?.content || m?.message));
    if (assistant) return assistant.content || assistant.message || '';
  }
  return '';
};

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const action = body?.action;

    if (action === 'start') {
      // A fresh conversation per session keeps one creator's song brief from
      // bleeding into the next one.
      const convo = await agentFetch('/conversations', {
        method: 'POST',
        body: { name: `BASE Station · ${user.full_name || user.email}` },
      });
      return Response.json({ conversation_id: convo?.id || convo?.conversation_id });
    }

    if (action === 'send') {
      const { conversation_id: conversationId, message } = body;
      if (!conversationId || !message?.trim()) {
        return Response.json({ error: 'conversation_id and message are required' }, { status: 400 });
      }
      const data = await agentFetch(`/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: { content: message },
      });
      return Response.json({ reply: extractReply(data), conversation_id: conversationId });
    }

    if (action === 'generate') {
      // Hand the crafted lyric + style brief to the existing music pipeline,
      // so the TemPolor job, credits and callbacks behave exactly as they do
      // for a form-based Quick Generate run.
      const { title, lyrics, sound_prompt: soundPrompt, genre, mood, tempo, duration, model, provider } = body;
      if (!lyrics?.trim()) {
        return Response.json({ error: 'Maestro has not produced lyrics yet' }, { status: 400 });
      }
      const res = await base44.functions.invoke('generateMusic', {
        provider: provider || 'tempcolor',
        title: title || 'Maestro Session',
        lyrics,
        sound_prompt: soundPrompt || '',
        genre: genre || '',
        mood: mood || '',
        tempo,
        duration: duration || 180,
        model,
        tempolor_mode: 'song',
        routing_reason: 'maestro_chat',
      });
      return Response.json(res.data);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}