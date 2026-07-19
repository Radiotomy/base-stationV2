import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { ShieldCheck, ShieldX, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LinkSourceCheck({ url, result, onResult }) {
  const [checking, setChecking] = useState(false);

  const verify = async () => {
    setChecking(true);
    try {
      const res = await base44.functions.invoke("verifyTrackSource", { mode: "link", url });
      onResult(res.data);
    } catch (e) {
      onResult({ verified: false, reason: e.message || "Verification failed" });
    }
    setChecking(false);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        External links must come from a verifiable source (Suno, Udio, YouTube, TikTok, SoundCloud, Audius, Spotify, Apple Music, Bandcamp…). Verification is required before submitting.
      </p>
      {!result && (
        <Button type="button" onClick={verify} disabled={!url || checking} variant="outline" size="sm" className="rounded-xl gap-2 text-xs">
          {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
          {checking ? "Verifying…" : "Verify Link"}
        </Button>
      )}
      {result && result.verified && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
          <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <p className="text-xs text-emerald-300">Verified source: <span className="font-bold">{result.source_name}</span></p>
        </div>
      )}
      {result && !result.verified && (
        <div className="flex items-start gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30">
          <ShieldX className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-red-300 font-semibold">Link not verified</p>
            <p className="text-xs text-red-300/80">{result.reason}</p>
          </div>
        </div>
      )}
    </div>
  );
}