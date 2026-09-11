import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Wand2, ImageIcon, Save, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const PLATFORMS = [
  { key: "twitter", label: "X / Twitter" },
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "facebook", label: "Facebook" },
  { key: "reddit", label: "Reddit" },
];

export default function SocialPostGenerator({ onSaved }) {
  const [platform, setPlatform] = useState("twitter");
  const [topic, setTopic] = useState("");
  const [campaign, setCampaign] = useState("");
  const [generating, setGenerating] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  const generate = async () => {
    if (!topic.trim()) { toast.error("Describe what you want to promote"); return; }
    setGenerating(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('generateMarketingPost', { platform, topic });
      setResult({ ...res.data, image_url: null });
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const generateImage = async () => {
    setImageLoading(true);
    try {
      const res = await base44.functions.invoke('generateMarketingPost', {
        image_concept: result.image_concept,
      });
      setResult(r => ({ ...r, image_url: res.data?.image_url }));
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message || "Image generation failed");
    } finally {
      setImageLoading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await base44.entities.MarketingContent.create({
        content_type: "social_post",
        title: result.title,
        platform,
        body: result.body,
        hashtags: result.hashtags || [],
        image_url: result.image_url || "",
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

  const copyPost = () => {
    navigator.clipboard.writeText(`${result.body}\n\n${(result.hashtags || []).join(" ")}`);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Platform</p>
          <div className="flex gap-1.5 flex-wrap">
            {PLATFORMS.map(({ key, label }) => (
              <button key={key} onClick={() => setPlatform(key)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                  platform === key
                    ? "border-purple-500/40 bg-purple-500/15 text-purple-300"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase mb-2">What are we promoting?</p>
          <Textarea value={topic} onChange={e => setTopic(e.target.value)} rows={4}
            placeholder="e.g. Launch of the Live Studio with 3D venues, our Creative Ownership Score system, a new-user signup push…" />
        </div>
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Campaign (optional)</p>
          <Input value={campaign} onChange={e => setCampaign(e.target.value)} placeholder="e.g. Summer Launch 2026" />
        </div>
        <Button onClick={generate} disabled={generating} className="w-full rounded-xl gap-2 font-bold merc-button">
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          {generating ? "Writing…" : "Generate Post"}
        </Button>
      </div>

      <div className="bg-card rounded-2xl border border-border p-5">
        {!result ? (
          <div className="h-full flex items-center justify-center text-center py-10">
            <p className="text-sm text-muted-foreground">Your platform-tuned post will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm font-black text-foreground">{result.title}</p>
            <div className="p-3 rounded-xl bg-muted/40 border border-border whitespace-pre-wrap text-sm text-foreground/90">
              {result.body}
            </div>
            {result.hashtags?.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {result.hashtags.map(h => (
                  <span key={h} className="text-xs text-purple-300 bg-purple-500/10 border border-purple-500/25 rounded-full px-2 py-0.5">
                    {h.startsWith("#") ? h : `#${h}`}
                  </span>
                ))}
              </div>
            )}
            {result.image_url ? (
              <img src={result.image_url} alt="Promo visual" className="rounded-xl border border-border w-full" />
            ) : (
              <p className="text-xs text-muted-foreground italic">Image concept: {result.image_concept}</p>
            )}
            <div className="flex gap-2 flex-wrap">
              {!result.image_url && (
                <Button onClick={generateImage} disabled={imageLoading} size="sm" variant="outline" className="rounded-xl gap-1.5 text-xs">
                  {imageLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
                  Generate Visual
                </Button>
              )}
              <Button onClick={copyPost} size="sm" variant="outline" className="rounded-xl gap-1.5 text-xs">
                <Copy className="w-3.5 h-3.5" /> Copy
              </Button>
              <Button onClick={save} disabled={saving} size="sm" className="rounded-xl gap-1.5 text-xs font-bold merc-button">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save to Library
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}