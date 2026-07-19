import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, ScanLine, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const VERDICT_LABELS = {
  likely_ai_generated: "Likely AI-generated",
  possibly_ai_assisted: "Possibly AI-assisted",
  likely_human: "Likely human-made",
  inconclusive: "Inconclusive",
};

export default function UploadAnalysisCheck({ fileUrl, declaredLabel, declaredTools, result, onResult }) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("verifyTrackSource", {
        mode: "audio",
        file_url: fileUrl,
        declared_label: declaredLabel,
        declared_tools: declaredTools,
      });
      onResult(res.data);
    } catch (e) {
      setError(e.message || "Analysis failed");
    }
    setRunning(false);
  };

  const consistent = result?.label_consistency === "consistent";

  return (
    <div className="space-y-2 pt-1">
      {!result && (
        <>
          <Button type="button" onClick={run} disabled={running} variant="outline" size="sm" className="rounded-xl gap-2 text-xs">
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanLine className="w-3.5 h-3.5" />}
            {running ? "Analyzing audio… (may take up to a minute)" : "Run AI Involvement Analysis"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Uploaded files get a heuristic AI-detection scan that's compared against your declared AI label. It's a screening aid, not proof — results are attached to your submission for the review team.
          </p>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </>
      )}
      {result && (
        <div className={`p-3 rounded-xl border space-y-2 ${consistent ? "bg-emerald-500/10 border-emerald-500/30" : "bg-amber-500/10 border-amber-500/30"}`}>
          <div className="flex items-center gap-2">
            {consistent
              ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              : <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />}
            <p className="text-xs font-bold text-foreground">
              {VERDICT_LABELS[result.verdict] || "Analysis complete"} · {Math.round(result.ai_likelihood ?? 0)}% AI likelihood
            </p>
          </div>
          <p className="text-xs text-foreground/80">{result.summary}</p>
          <p className={`text-xs font-semibold ${consistent ? "text-emerald-300" : "text-amber-300"}`}>
            {consistent
              ? "Consistent with your declared AI label."
              : `Flagged as ${result.label_consistency} with your declared label — the review team will see this.`}
          </p>
          {result.indicators?.length > 0 && (
            <ul className="text-[11px] text-muted-foreground list-disc pl-4 space-y-0.5">
              {result.indicators.slice(0, 4).map((ind, i) => <li key={i}>{ind}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}