import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { MessagesSquare, Plus, UserCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import useForumIdentity from "@/hooks/useForumIdentity";
import { FORUM_CATEGORIES } from "@/components/forum/ForumCategoryBadge";
import ThreadListItem from "@/components/forum/ThreadListItem";
import GuestRegisterDialog from "@/components/forum/GuestRegisterDialog";
import NewThreadDialog from "@/components/forum/NewThreadDialog";

export default function Forum() {
  const { member, loading: idLoading, registerGuest } = useForumIdentity();
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [showRegister, setShowRegister] = useState(false);
  const [showNewThread, setShowNewThread] = useState(false);

  const loadThreads = useCallback(async (cat) => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("forumApi", { action: "listThreads", category: cat || "" });
      setThreads(res.data?.threads || []);
    } catch {
      setThreads([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadThreads(category);
  }, [category, loadThreads]);

  const startThread = () => {
    if (!member) setShowRegister(true);
    else setShowNewThread(true);
  };

  const handleRegister = async (name, email) => {
    await registerGuest(name, email);
    setShowNewThread(true);
  };

  const handleCreateThread = async (data) => {
    const guest = JSON.parse(localStorage.getItem("bs_forum_identity") || "null");
    const res = await base44.functions.invoke("forumApi", {
      action: "createThread",
      ...data,
      member_id: guest?.member_id,
      token: guest?.token,
    });
    if (res.data?.error) throw new Error(res.data.error);
    await loadThreads(category);
  };

  return (
    <div className="min-h-screen pt-20 pb-16 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="space-y-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-2 text-[#FFC98A] text-xs font-bold tracking-wider uppercase">
                <MessagesSquare className="w-3.5 h-3.5" /> Community Forum
              </div>
              <h1 className="font-display text-3xl md:text-4xl text-white">Speak your mind</h1>
              <p className="text-sm text-muted-foreground max-w-xl mt-1">
                Open discussion on our legal terms, the Creative Ownership Score, and AI music
                policy. Anyone can post — no BASE Station account required.
              </p>
            </div>
            <Button onClick={startThread} className="merc-button rounded-full font-bold">
              <Plus className="w-4 h-4" /> New Discussion
            </Button>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-white/50 font-semibold">
            <UserCircle2 className="w-3.5 h-3.5" />
            {idLoading
              ? "Checking identity…"
              : member
                ? <>Posting as <span className="text-white">{member.display_name}</span>{member.source === "member" && " (BASE Station member)"}</>
                : <>Browsing as guest — <button onClick={() => setShowRegister(true)} className="text-[#FF9A4D] underline underline-offset-2">create a forum profile</button> to post. Or <Link to="/login" className="text-[#FF9A4D] underline underline-offset-2">log in to BASE Station</Link>.</>}
          </div>
        </header>

        {/* Category filter */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategory("")}
            className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-all ${
              category === "" ? "text-[#14100C] bg-[#FF9A4D] border-[#FF9A4D]" : "text-white/40 border-white/10 hover:border-white/30"
            }`}
          >
            All
          </button>
          {FORUM_CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-all ${
                category === c.key ? c.color : "text-white/40 border-white/10 hover:border-white/30"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Thread list */}
        {loading ? (
          <div className="py-16 flex justify-center">
            <div className="w-8 h-8 border-4 border-[#FF9A4D]/30 border-t-[#FF9A4D] rounded-full animate-spin" />
          </div>
        ) : threads.length === 0 ? (
          <div className="merc-card rounded-2xl p-10 text-center space-y-3">
            <MessagesSquare className="w-10 h-10 text-white/20 mx-auto" />
            <p className="text-white font-bold">No discussions here yet</p>
            <p className="text-sm text-muted-foreground">
              Be the first to share your thoughts on AI music policy, the COS, or our legal terms.
            </p>
            <Button onClick={startThread} variant="outline" className="rounded-full">
              <Plus className="w-4 h-4" /> Start the first discussion
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {threads.map((t) => <ThreadListItem key={t.id} thread={t} />)}
          </div>
        )}
      </div>

      <GuestRegisterDialog open={showRegister} onOpenChange={setShowRegister} onRegister={handleRegister} />
      <NewThreadDialog open={showNewThread} onOpenChange={setShowNewThread} onSubmit={handleCreateThread} defaultCategory={category || "general"} />
    </div>
  );
}