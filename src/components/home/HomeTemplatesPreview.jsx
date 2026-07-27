import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { ChevronRight, Copy, Heart, Zap } from "lucide-react";

export default function HomeTemplatesPreview() {
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    base44.entities.PromptTemplate.filter({ is_public: true }, "-like_count", 3)
      .then(setTemplates)
      .catch(() => {});
  }, []);

  if (templates.length === 0) return null;

  return (
    <div className="rounded-xl border-2 border-black bg-gradient-to-b from-[#1C1712] to-[#0F0C09] p-4 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-white text-xl md:text-2xl">Community Templates</h2>
        <Link to="/templates" className="text-xs text-white/60 hover:text-white flex items-center gap-1 font-semibold">
          View All <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {templates.map((t) => (
          <Link key={t.id} to="/templates"
            className="p-3 rounded-lg border border-black/70 bg-[#171310] hover:border-[#FF9A4D]/50 transition-colors">
            <p className="text-sm font-black text-white truncate mb-1">{t.title}</p>
            <p className="text-xs text-white/50 font-mono line-clamp-2 mb-2">{t.prompt}</p>
            <div className="flex items-center gap-3 text-[11px] text-white/40">
              <span className="flex items-center gap-1"><Copy className="w-3 h-3" />{t.use_count || 0}</span>
              <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{t.like_count || 0}</span>
              {t.genre && <span className="flex items-center gap-1 ml-auto"><Zap className="w-3 h-3" />{t.genre}</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}