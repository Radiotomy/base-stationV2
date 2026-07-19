import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Wand2, Save, Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const BRAND_CONTEXT = `BASE Station is an AI music creation platform: 11+ AI studios (music, lyrics, mastering, cover art, video, visualizers), live streaming with 3D venues, community charts & radio, a fan economy (tips, collectibles, fan clubs), and industry-leading AI transparency — Creative Ownership Scores, RIAA/IFPI-aligned AI labels, on-chain provenance records on Base, and DDEX metadata exports. The platform's mission is human-first, transparent AI music creation.`;

export default function PressReleaseGenerator({ onSaved }) {
  const [announcement, setAnnouncement] = useState("");
  const [quoteFrom, setQuoteFrom] = useState("");
  const [campaign, setCampaign] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  const generate = async () => {
    if (!announcement.trim()) { toast.error("Describe the announcement"); return; }
    setGenerating(true);
    setResult(null);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a music-tech PR professional writing for BASE Station. ${BRAND_CONTEXT}\n\nWrite a complete, professional press release announcing: ${announcement}\n${quoteFrom ? `Include an attributed quote from: ${quoteFrom}.` : "Include a quote attributed to a BASE Station spokesperson."}\n\nUse standard press release structure: headline, subheadline, dateline (city + today's date), lead paragraph with the key news, body paragraphs with detail and context, the quote, a boilerplate "About BASE Station" section, and a media contact placeholder. Write in AP style.`,
        response_json_schema: {
          type: "object",
          properties: {
            headline: { type: "string" },
            body: { type: "string", description: "Full press release text including subheadline, dateline, paragraphs, quote, boilerplate and contact" },
          },
        },
      });
      setResult(res);
    } catch (e) {
      toast.error(e.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await base44.entities.MarketingContent.create({
        content_type: "press_release",
        title: result.headline,
        platform: "press",
        body: result.body,
        campaign: campaign.trim(),
        status: "ready",
      });
      toast.success("Saved to library");
      onSaved?.();
    } catch (e) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const copyText = () => {
    navigator.clipboard.writeText(`${result.headline}\n\n${result.body}`);
    toast.success("Copied to clipboard");
  };

  const downloadTxt = () => {
    const blob = new Blob([`${result.headline}\n\n${result.body}`], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${result.headline.slice(0, 50).replace(/[^a-z0-9]+/gi, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-5">
      <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Announcement</p>
          <Textarea value={announcement} onChange={e => setAnnouncement(e.target.value)} rows={3}
            placeholder="e.g. BASE Station launches on-chain provenance certificates for AI-assisted music on the Base network…" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Quote attributed to (optional)</p>
            <Input value={quoteFrom} onChange={e => setQuoteFrom(e.target.value)} placeholder="e.g. Jane Doe, Founder of BASE Station" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Campaign (optional)</p>
            <Input value={campaign} onChange={e => setCampaign(e.target.value)} placeholder="e.g. Provenance Launch" />
          </div>
        </div>
        <Button onClick={generate} disabled={generating} className="rounded-xl gap-2 font-bold merc-button">
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          {generating ? "Writing…" : "Generate Press Release"}
        </Button>
      </div>

      {result && (
        <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
          <h3 className="text-lg font-black text-foreground">{result.headline}</h3>
          <div className="p-4 rounded-xl bg-muted/40 border border-border whitespace-pre-wrap text-sm text-foreground/90 max-h-[420px] overflow-y-auto">
            {result.body}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={copyText} size="sm" variant="outline" className="rounded-xl gap-1.5 text-xs">
              <Copy className="w-3.5 h-3.5" /> Copy
            </Button>
            <Button onClick={downloadTxt} size="sm" variant="outline" className="rounded-xl gap-1.5 text-xs">
              <Download className="w-3.5 h-3.5" /> Download .txt
            </Button>
            <Button onClick={save} disabled={saving} size="sm" className="rounded-xl gap-1.5 text-xs font-bold merc-button">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save to Library
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}