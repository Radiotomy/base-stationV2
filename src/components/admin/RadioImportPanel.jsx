import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Radio, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// Admin tool: bulk-import generated library tracks from any account into the radio.
export default function RadioImportPanel({ onChanged }) {
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState([]);
  const [max, setMax] = useState("100");
  const [busy, setBusy] = useState("");

  const run = async (action, extra = {}) => {
    setBusy(action);
    const res = await base44.functions.invoke("importLibraryToRadio", { action, ...extra });
    setBusy("");
    return res.data;
  };
  const load = async () => setData(await run("preview"));
  useEffect(() => { load(); }, []);

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const doImport = async () => {
    const r = await run("import", { user_ids: selected, max: Number(max) });
    toast.success(`Imported ${r.imported} tracks to the radio`);
    await load(); onChanged?.();
  };
  const doApprove = async () => {
    const r = await run("approve_pending");
    toast.success(`Approved ${r.approved} pending tracks`);
    await load(); onChanged?.();
  };

  const eligible = data?.accounts.filter((a) => !selected.length || selected.includes(a.user_id)).reduce((n, a) => n + a.count, 0) || 0;

  return (
    <div className="rounded-2xl bg-card border border-border p-5 mb-6 space-y-4">
      <div>
        <h2 className="font-black text-foreground flex items-center gap-2"><Radio className="w-4 h-4" /> Import Library Tracks to Radio</h2>
        <p className="text-xs text-muted-foreground">Picks random generated tracks from the chosen accounts and adds them as approved tracks. Tracks already on the radio are skipped.</p>
      </div>
      {!data ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : data.accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No new library tracks to import.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {data.accounts.map((a) => (
            <button key={a.user_id} onClick={() => toggle(a.user_id)}
              className={`px-3 py-1.5 rounded-xl border text-xs text-left ${selected.includes(a.user_id) ? "border-foreground bg-white/10" : "border-border"}`}>
              <span className="font-semibold text-foreground">{a.name}</span> <span className="text-muted-foreground">· {a.count}</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-muted-foreground">{selected.length ? `${selected.length} accounts` : "All accounts"} · {eligible} available · up to</span>
        <Input type="number" min="1" max="500" value={max} onChange={(e) => setMax(e.target.value)} className="w-24 h-8 rounded-lg" />
        <Button size="sm" onClick={doImport} disabled={!!busy || !eligible} className="rounded-lg gap-1">
          {busy === "import" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Radio className="w-3 h-3" />} Import to Radio
        </Button>
        <Button size="sm" variant="outline" onClick={doApprove} disabled={!!busy || !data?.pending} className="rounded-lg gap-1">
          {busy === "approve_pending" ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />} Approve all pending ({data?.pending || 0})
        </Button>
      </div>
    </div>
  );
}