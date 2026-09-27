import { useState } from "react";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";

const PRESETS = [300, 500, 1000, 2500];

export default function CardTipSender({ artistId, message }) {
  const [cents, setCents] = useState(500);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const checkout = async () => {
    setError("");
    if (window.self !== window.top) { setError("Card checkout only works from the published app — open it in a new tab."); return; }
    setBusy(true);
    const res = await base44.functions.invoke("createTipCheckout", {
      artist_id: artistId, amount_cents: cents, message, return_url: window.location.href,
    }).catch((e) => ({ data: { error: e?.response?.data?.error || e.message } }));
    if (res.data?.url) { window.location.href = res.data.url; return; }
    setError(res.data?.error || "Could not start checkout");
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        {PRESETS.map((c) => (
          <button key={c} onClick={() => setCents(c)}
            className={`py-2 rounded-xl border text-sm font-semibold ${cents === c ? "border-foreground bg-white/10" : "border-border"}`}>
            ${c / 100}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button onClick={checkout} disabled={busy} className="w-full rounded-xl gap-2">
        {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Opening checkout…</> : `Pay $${cents / 100} with card`}
      </Button>
    </div>
  );
}