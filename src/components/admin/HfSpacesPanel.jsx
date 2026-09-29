import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Power, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const call = (payload) => base44.functions.invoke("hfSpaceWake", payload).then((r) => r.data.spaces);

export default function HfSpacesPanel() {
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [waking, setWaking] = useState({});

  const refresh = () => { setLoading(true); call({ action: "status" }).then(setSpaces).finally(() => setLoading(false)); };
  useEffect(refresh, []);

  const wake = async (name) => {
    setWaking((w) => ({ ...w, [name]: true }));
    const [r] = await call({ action: "wake", space: name }).finally(() => setWaking((w) => ({ ...w, [name]: false })));
    setSpaces((s) => s.map((x) => (x.name === name ? r : x)));
    toast[r.status === "running" ? "success" : "info"](
      r.status === "running" ? `${name} is running` : `${name} is booting — check again in a few minutes`
    );
  };

  const asleep = spaces.filter((s) => s.status === "asleep");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-bold text-foreground">Hugging Face Engines</h3>
          <p className="text-xs text-muted-foreground">Spaces sleep after ~48h idle. Waking one boots it; cold starts take a few minutes.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={refresh} disabled={loading}><RefreshCw className="w-4 h-4" /> Check</Button>
          <Button size="sm" disabled={!asleep.length} onClick={() => asleep.forEach((s) => wake(s.name))}><Power className="w-4 h-4" /> Wake all asleep</Button>
        </div>
      </div>
      {loading ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {spaces.map((s) => (
            <div key={s.name} className="flex items-center justify-between p-3 rounded-xl bg-card border border-border">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full ${s.status === "running" ? "bg-green-400" : s.status === "asleep" ? "bg-amber-400" : "bg-muted-foreground"}`} />
                <span className="text-sm font-mono truncate">{s.name}</span>
                <span className="text-xs text-muted-foreground">{s.status}</span>
              </div>
              {s.status === "asleep" && (
                <Button size="sm" variant="outline" onClick={() => wake(s.name)} disabled={waking[s.name]}>
                  {waking[s.name] ? <Loader2 className="w-4 h-4 animate-spin" /> : "Wake"}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}