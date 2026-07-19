import { Link } from "react-router-dom";
import { MessageSquare, Pin } from "lucide-react";
import moment from "moment";
import ForumCategoryBadge from "@/components/forum/ForumCategoryBadge";

export default function ThreadListItem({ thread }) {
  return (
    <Link
      to={`/forum/${thread.id}`}
      className="merc-card merc-card-hover rounded-xl p-4 flex items-start gap-3 transition-all block"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          {thread.is_pinned && <Pin className="w-3.5 h-3.5 text-[#FF9A4D]" />}
          <ForumCategoryBadge category={thread.category} />
          {thread.author_source === "member" && (
            <span className="text-[10px] font-bold text-[#FF9A4D]/80">★ BASE Station member</span>
          )}
        </div>
        <h3 className="font-bold text-white text-sm truncate">{thread.title}</h3>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{thread.body}</p>
        <p className="text-[10px] text-white/40 mt-1.5 font-semibold">
          {thread.author_name} · {moment(thread.created_date).fromNow()}
        </p>
      </div>
      <div className="flex items-center gap-1 text-white/50 text-xs font-bold flex-shrink-0 pt-1">
        <MessageSquare className="w-3.5 h-3.5" />
        {thread.reply_count || 0}
      </div>
    </Link>
  );
}