import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { MessageCircle, X, Send, Bot, Minimize2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SYSTEM_CONTEXT = `You are AiVTV, the friendly AI assistant for the AIVTV platform — the world's premier AI music and creator community. 
Help users with:
- How to create and join live music sessions
- How to submit tracks and vote
- Playlists: creating, browsing, adding tracks
- Trending charts and how rankings work
- Radio channels and how to tune in
- Following artists and the activity feed
- The Featured Artist Program and how to apply
- AI Tools Studio (music generation, lyric studio, cover art)
- Upcoming features: challenges, badges, crypto tipping, Solana track registration
- General platform navigation

Be concise, enthusiastic, and friendly. Keep responses under 3 sentences unless a detailed explanation is needed. Use emojis sparingly but effectively.`;

const SUGGESTED = [
  "How do I create a playlist?",
  "How do trending charts work?",
  "How do I apply to be a featured artist?",
  "What is AIVTV Radio?",
  "How do I follow an artist?",
];

export default function AIHelpAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hey! I'm AiVTV 🎵 Your AI guide to the platform. What can I help you with today?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuggested, setShowSuggested] = useState(true);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text) => {
    const userMsg = text || input.trim();
    if (!userMsg || loading) return;
    setInput("");
    setShowSuggested(false);

    const newMessages = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setLoading(true);

    const conversationHistory = newMessages.map(m => `${m.role === "user" ? "User" : "AiVTV"}: ${m.content}`).join("\n");
    const prompt = `${SYSTEM_CONTEXT}\n\nConversation so far:\n${conversationHistory}\n\nAiVTV:`;

    const response = await base44.integrations.Core.InvokeLLM({ prompt });
    setMessages(prev => [...prev, { role: "assistant", content: response }]);
    setLoading(false);
  };

  return (
    <>
      {/* Floating Button */}
      <AnimatePresence>
        {!open && (
          <motion.button initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 shadow-2xl shadow-purple-900/50 flex items-center justify-center hover:scale-110 transition-transform">
            <MessageCircle className="w-6 h-6 text-white" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-background animate-pulse" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 w-80 sm:w-96 h-[520px] rounded-3xl bg-card border border-border shadow-2xl shadow-black/40 flex flex-col overflow-hidden">

            {/* Header */}
            <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-purple-900 to-indigo-900 border-b border-white/10">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-white text-sm">AiVTV</p>
                <p className="text-white/50 text-xs flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                  Always online · AI-powered guide
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white transition-colors p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                  <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${msg.role === "user"
                    ? "bg-purple-600 text-white rounded-tr-sm"
                    : "bg-muted text-foreground rounded-tl-sm"
                  }`}>
                    {msg.content}
                  </div>
                </motion.div>
              ))}

              {loading && (
                <div className="flex gap-2 justify-start">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-muted">
                    <div className="flex gap-1">
                      {[0, 150, 300].map(d => <div key={d} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                    </div>
                  </div>
                </div>
              )}

              {/* Suggested Questions */}
              {showSuggested && (
                <div className="space-y-1.5 mt-2">
                  <p className="text-xs text-muted-foreground px-1">Suggested questions:</p>
                  {SUGGESTED.map(q => (
                    <button key={q} onClick={() => send(q)}
                      className="w-full text-left text-xs px-3 py-2 rounded-xl bg-muted/60 hover:bg-purple-500/20 hover:text-purple-300 border border-border hover:border-purple-500/40 transition-all">
                      {q}
                    </button>
                  ))}
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border bg-background/80 backdrop-blur">
              <form onSubmit={e => { e.preventDefault(); send(); }} className="flex gap-2">
                <Input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask me anything…"
                  className="flex-1 rounded-xl text-sm border-border bg-muted/50 h-9" />
                <Button type="submit" disabled={loading || !input.trim()} size="icon"
                  className="rounded-xl h-9 w-9 bg-purple-600 hover:bg-purple-500 flex-shrink-0">
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}