import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Copy, Trash2, Megaphone, FileText, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const TYPE_META = {
  social_post: { icon: Megaphone, label: "Social" },
  press_release: { icon: FileText, label: "Press" },
  promotion: { icon: Megaphone, label: "Promo" },
};

export default function MarketingLibrary({ refreshKey }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    base44.entities.MarketingContent.list("-created_date", 100)
      .then(setItems)
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const remove = async (id) => {
    await base44.entities.MarketingContent.delete(id);
    setItems(prev => prev.filter(i => i.id !== id));
    toast.success("Deleted");
  };

  const markPublished = async (item) => {
    const updated = await base44.entities.MarketingContent.update(item.id, { status: "published" });
    setItems(prev => prev.map(i => (i.id === item.id ? (updated || { ...i, status: "published" }) : i)));
    toast.success("Marked as published");
  };

  const copyItem = (item) => {
    navigator.clipboard.writeText(`${item.body}${item.hashtags?.length ? `\n\n${item.hashtags.map(h => h.startsWith("#") ? h : `#${h}`).join(" ")}` : ""}`);
    toast.success("Copied to clipboard");
  };

  const filtered = filter === "all" ? items : items.filter(i => i.content_type === filter);

  if (loading) return (
    <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 flex-wrap">
        {[["all", "All"], ["social_post", "Social"], ["press_release", "Press"]].map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
              filter === key ? "border-purple-500/40 bg-purple-500/15 text-purple-300" : "border-border text-muted-foreground hover:text-foreground"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-2xl text-sm text-muted-foreground">
          Nothing saved yet — generate content in the Social Posts or Press tabs.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => {
            const meta = TYPE_META[item.content_type] || TYPE_META.promotion;
            const Icon = meta.icon;
            return (
              <div key={item.id} className="bg-card rounded-2xl border border-border p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    <p className="text-sm font-bold text-foreground truncate">{item.title}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Badge variant="secondary" className="text-[10px] capitalize">{item.platform}</Badge>
                    <Badge variant={item.status === "published" ? "default" : "outline"} className="text-[10px] capitalize">{item.status}</Badge>
                  </div>
                </div>
                {item.campaign && <p className="text-[11px] text-muted-foreground mb-1.5">Campaign: {item.campaign}</p>}
                <p className="text-xs text-foreground/75 whitespace-pre-wrap line-clamp-4 mb-3">{item.body}</p>
                {item.image_url && (
                  <img src={item.image_url} alt="" className="rounded-lg border border-border max-h-40 mb-3" />
                )}
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={() => copyItem(item)} size="sm" variant="outline" className="rounded-lg gap-1.5 text-xs h-7">
                    <Copy className="w-3 h-3" /> Copy
                  </Button>
                  {item.status !== "published" && (
                    <Button onClick={() => markPublished(item)} size="sm" variant="outline" className="rounded-lg gap-1.5 text-xs h-7">
                      <CheckCircle2 className="w-3 h-3" /> Mark Published
                    </Button>
                  )}
                  <Button onClick={() => remove(item.id)} size="sm" variant="ghost" className="rounded-lg gap-1.5 text-xs h-7 text-destructive hover:text-destructive">
                    <Trash2 className="w-3 h-3" /> Delete
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}