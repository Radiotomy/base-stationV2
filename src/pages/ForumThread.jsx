import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Lock, Send } from "lucide-react";
import moment from "moment";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import useForumIdentity from "@/hooks/useForumIdentity";
import ForumCategoryBadge from "@/components/forum/ForumCategoryBadge";
import GuestRegisterDialog from "@/components/forum/GuestRegisterDialog";

export default function ForumThread() {
  const { id } = useParams();
  const { member, registerGuest } = useForumIdentity();
  const [thread, setThread] = useState(null);
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [showRegister, setShowRegister] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("forumApi", { action: "getThread", thread_id: id });
      if (res.data?.thread) {
        setThread(res.data.thread);
        setReplies(res.data.replies || []);
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const sendReply = async () => {
    if (!member) {
      setShowRegister(true);
      return;
    }
    setSending(true);
    setError("");
    try {
      const guest = JSON.parse(localStorage.getItem("bs_forum_identity") || "null");
      const res = await base44.functions.invoke("forumApi", {
        action: "createReply",
        thread_id: id,
        body: replyText,
        member_id: guest?.member_id,
        token: guest?.token,
      });
      if (res.data?.error) throw new Error(res.data.error);
      setReplyText("");
      await load();
    } catch (err) {
      setError(err.message || "Could not post your reply.");
    }
    setSending(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#FF9A4D]/30 border-t-[#FF9A4D] rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen pt-24 px-4 text-center space-y-4">
        <p className="text-white font-bold">Discussion not found.</p>
        <Link to="/forum" className="text-[#FF9A4D] underline underline-offset-2 text-sm">Back to the forum</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-16 px-4">
      <div className="max-w-3xl mx-auto space-y-5">
        <Link to="/forum" className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white font-semibold transition-colors">
          <ArrowLeft className="w-4 h-4" /> All discussions
        </Link>

        {/* Original post */}
        <article className="merc-card rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <ForumCategoryBadge category={thread.category} />
            {thread.author_source === "member" && (
              <span className="text-[10px] font-bold text-[#FF9A4D]/80">★ BASE Station member</span>
            )}
            {thread.is_locked && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white/50">
                <Lock className="w-3 h-3" /> Locked
              </span>
            )}
          </div>
          <h1 className="font-display text-2xl md:text-3xl text-white">{thread.title}</h1>
          <p className="text-[11px] text-white/40 font-semibold">
            {thread.author_name} · {moment(thread.created_date).format("MMM D, YYYY [at] h:mm A")}
          </p>
          <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">{thread.body}</p>
        </article>

        {/* Replies */}
        <div className="space-y-2">
          <h2 className="text-sm font-black text-white/70 uppercase tracking-wider">
            {replies.length} {replies.length === 1 ? "Reply" : "Replies"}
          </h2>
          {replies.map((r) => (
            <div key={r.id} className="merc-card rounded-xl p-4">
              <p className="text-[11px] text-white/40 font-semibold mb-1.5">
                <span className="text-white/80">{r.author_name}</span>
                {r.author_source === "member" && <span className="text-[#FF9A4D]/80"> ★</span>}
                {" · "}{moment(r.created_date).fromNow()}
              </p>
              <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">{r.body}</p>
            </div>
          ))}
        </div>

        {/* Reply box */}
        {thread.is_locked ? (
          <p className="text-sm text-white/40 text-center py-4">This discussion has been locked by moderators.</p>
        ) : (
          <div className="merc-card rounded-2xl p-4 space-y-3">
            <Textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={member ? `Reply as ${member.display_name}…` : "Write a reply — you'll be asked to pick a display name…"}
              rows={4}
              maxLength={5000}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end">
              <Button onClick={sendReply} disabled={sending || replyText.trim().length < 2} className="merc-button rounded-full font-bold">
                <Send className="w-4 h-4" /> {sending ? "Posting…" : "Post reply"}
              </Button>
            </div>
          </div>
        )}
      </div>

      <GuestRegisterDialog
        open={showRegister}
        onOpenChange={setShowRegister}
        onRegister={async (name, email) => {
          await registerGuest(name, email);
        }}
      />
    </div>
  );
}