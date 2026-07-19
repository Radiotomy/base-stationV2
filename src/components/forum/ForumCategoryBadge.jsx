export const FORUM_CATEGORIES = [
  { key: "legal", label: "Legal & Terms", color: "text-[#FFC98A] border-[#FFC98A]/30 bg-[#FFC98A]/10" },
  { key: "cos", label: "COS & Scoring", color: "text-[#6EE7B7] border-[#6EE7B7]/30 bg-[#6EE7B7]/10" },
  { key: "ai_policy", label: "AI Music Policy", color: "text-[#93C5FD] border-[#93C5FD]/30 bg-[#93C5FD]/10" },
  { key: "general", label: "General", color: "text-white/60 border-white/20 bg-white/5" },
];

export default function ForumCategoryBadge({ category }) {
  const cat = FORUM_CATEGORIES.find((c) => c.key === category) || FORUM_CATEGORIES[3];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${cat.color}`}>
      {cat.label}
    </span>
  );
}