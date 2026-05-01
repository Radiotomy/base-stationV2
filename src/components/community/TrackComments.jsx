import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Send, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function CommentItem({ comment, currentUser, onReply }) {
  const isOwn = currentUser?.id === comment.user_id;

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center flex-shrink-0 text-xs font-black text-white">
        {(comment.user_name || "?")[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-xs font-bold text-foreground">{comment.user_name || "Listener"}</span>
          <span className="text-xs text-muted-foreground">{timeAgo(comment.created_date)}</span>
        </div>
        <p className="text-sm text-foreground/90 mt-0.5 leading-relaxed">{comment.body}</p>
        <button onClick={() => onReply(comment)} className="text-xs text-muted-foreground hover:text-purple-400 mt-1 transition-colors">
          Reply
        </button>
      </div>
    </motion.div>
  );
}

export default function TrackComments({ trackId, trackTitle, currentUser }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!trackId) return;
    base44.entities.Comment.filter({ track_id: trackId }, "-created_date", 50)
      .then(data => { setComments(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [trackId]);

  const submit = async () => {
    if (!body.trim()) return;
    if (!currentUser) { toast.error("Sign in to comment"); return; }
    setSubmitting(true);
    const newComment = await base44.entities.Comment.create({
      track_id: trackId,
      track_title: trackTitle,
      user_id: currentUser.id,
      user_name: currentUser.full_name,
      user_email: currentUser.email,
      body: body.trim(),
      ...(replyTo && { parent_id: replyTo.id }),
    });
    setComments(prev => [newComment, ...prev]);
    setBody("");
    setReplyTo(null);
    setSubmitting(false);
  };

  const topLevel = comments.filter(c => !c.parent_id);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-purple-400" />
        Comments <span className="text-muted-foreground font-normal">({comments.length})</span>
      </h3>

      {/* Input */}
      {currentUser ? (
        <div className="space-y-2">
          {replyTo && (
            <div className="flex items-center gap-2 text-xs text-purple-300 bg-purple-500/10 px-3 py-1.5 rounded-lg">
              Replying to <span className="font-bold">{replyTo.user_name}</span>
              <button onClick={() => setReplyTo(null)} className="ml-auto text-muted-foreground hover:text-foreground">✕</button>
            </div>
          )}
          <div className="flex gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center flex-shrink-0 text-xs font-black text-white">
              {(currentUser.full_name || "?")[0].toUpperCase()}
            </div>
            <div className="flex-1 flex gap-2">
              <input
                value={body}
                onChange={e => setBody(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && submit()}
                placeholder="Share your thoughts…"
                className="flex-1 rounded-xl border border-input bg-muted/50 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <Button onClick={submit} disabled={submitting || !body.trim()} size="icon" className="rounded-xl bg-purple-600 hover:bg-purple-500 flex-shrink-0">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground px-1">
          <button onClick={() => base44.auth.redirectToLogin()} className="text-purple-400 hover:underline">Sign in</button> to leave a comment.
        </p>
      )}

      {/* Comments list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-12 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : topLevel.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">No comments yet — be the first!</p>
      ) : (
        <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
          <AnimatePresence>
            {topLevel.map(c => (
              <div key={c.id}>
                <CommentItem comment={c} currentUser={currentUser} onReply={setReplyTo} />
                {/* Replies */}
                {comments.filter(r => r.parent_id === c.id).map(reply => (
                  <div key={reply.id} className="ml-11 mt-2">
                    <CommentItem comment={reply} currentUser={currentUser} onReply={setReplyTo} />
                  </div>
                ))}
              </div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}