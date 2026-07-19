import { useState } from "react";
import { Megaphone, FileText, FolderOpen } from "lucide-react";
import SocialPostGenerator from "@/components/admin/marketing/SocialPostGenerator";
import PressReleaseGenerator from "@/components/admin/marketing/PressReleaseGenerator";
import MarketingLibrary from "@/components/admin/marketing/MarketingLibrary";

const TABS = [
  { key: "social", label: "Social Posts", icon: Megaphone },
  { key: "press", label: "Press", icon: FileText },
  { key: "library", label: "Library", icon: FolderOpen },
];

export default function AdminMarketing() {
  const [tab, setTab] = useState("social");
  const [refreshKey, setRefreshKey] = useState(0);
  const onSaved = () => setRefreshKey(k => k + 1);

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-foreground">Marketing & Promotion</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Produce social posts, press releases and promo campaigns for BASE Station itself.
        </p>
      </div>

      <div className="flex gap-1.5 mb-6 flex-wrap">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all ${
              tab === key
                ? "border-purple-500/40 bg-purple-500/15 text-purple-300"
                : "border-border bg-card/50 text-muted-foreground hover:text-foreground"
            }`}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === "social" && <SocialPostGenerator onSaved={onSaved} />}
      {tab === "press" && <PressReleaseGenerator onSaved={onSaved} />}
      {tab === "library" && <MarketingLibrary refreshKey={refreshKey} />}
    </div>
  );
}