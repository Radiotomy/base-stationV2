import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Flame, Heart, Zap, Star, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const QUICK_REACTIONS = [
  { emoji: "🔥", label: "fire" },
  { emoji: "❤️", label: "heart" },
  { emoji: "⚡", label: "zap" },
  { emoji: "🎵", label: "music" },
  { emoji: "🐐", label: "goat" },
];

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

export default function LiveChatPanel({ sessionId, currentUser, isLive }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!sessionId) return;
    // Load recent messages
    base44.entities.LiveChatMessage.filter({ session_id: sessionId }, "-created_date", 50)
      .then(data => setMessages(data.reverse()))
      .catch(() => {});

    // Subscribe to new messages in real-time
    const unsub = base44.entities.LiveChatMessage.subscribe(evt => {
      if (evt.type === "create" && evt.data?.session_id === sessionId) {
        setMessages(prev => [...prev, evt.data]);
      }
    });
    return unsub;
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (messageText, type = "chat", emoji = null) => {
    if (!currentUser) { toast.error("Sign in to chat"); return; }
    if (!sessionId) { toast.error("No active session"); return; }
    setSending(true);
    await base44.entities.LiveChatMessage.create({
      session_id: sessionId,
      user_id: currentUser.id,
      user_name: currentUser.full_name || "Listener",
      user_email: currentUser.email,
      message: messageText,
      type,
      ...(emoji && { emoji }),
    });
    setInput("");
    setSending(false);
  };

  const sendReaction = (emoji) => send(emoji, "reaction", emoji);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && input.trim()) {
      e.preventDefault();
      send(input.trim());
    }
  };

  return (
    <div className="flex flex-col h-full bg-card rounded-2xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border flex-shrink-0">
        <div className={`w-2 h-2 rounded-full ${isLive ? "bg-red-500 animate-pulse" : "bg-muted-foreground"}`} />
        <span className="text-sm font-bold text-foreground">{isLive ? "Live Chat" : "Session Chat"}</span>
        <span className="text-xs text-muted-foreground ml-auto">{messages.length} messages</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {messages.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-xs">
            {isLive ? "Chat is live — say something! 🎵" : "No messages yet"}
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className={`flex gap-2 ${msg.type === "reaction" ? "justify-center" : ""}`}>
              {msg.type === "reaction" ? (
                <motion.span
                  initial={{ scale: 0 }} animate={{ scale: [1.4, 1] }}
                  className="text-2xl">{msg.message}
                </motion.span>
              ) : msg.type === "system" ? (
                <p className="text-xs text-muted-foreground italic text-center w-full">{msg.message}</p>
              ) : (
                <>
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center flex-shrink-0 text-xs font-black text-white">
                    {(msg.user_name || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs font-bold text-foreground">{msg.user_name}</span>
                      <span className="text-xs text-muted-foreground">{timeAgo(msg.created_date)}</span>
                    </div>
                    <p className="text-xs text-foreground/90 leading-relaxed break-words">{msg.message}</p>
                  </div>
                </>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Quick Reactions */}
      <div className="flex gap-1.5 px-3 py-2 border-t border-border flex-shrink-0">
        {QUICK_REACTIONS.map(({ emoji }) => (
          <button key={emoji} onClick={() => sendReaction(emoji)}
            className="flex-1 text-center py-1.5 rounded-lg bg-muted/50 hover:bg-muted text-base transition-all active:scale-95">
            {emoji}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2 p-3 border-t border-border flex-shrink-0">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={currentUser ? "Say something…" : "Sign in to chat"}
          disabled={!currentUser || !isLive}
          className="flex-1 rounded-xl border border-input bg-muted/50 px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
        />
        <Button onClick={() => input.trim() && send(input.trim())} disabled={sending || !input.trim() || !currentUser || !isLive}
          size="icon" className="rounded-xl bg-red-600 hover:bg-red-500 flex-shrink-0 h-9 w-9">
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}