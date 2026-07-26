import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cpu, Ban, RefreshCw, Upload, Shield, Activity, Server,
  XCircle, CheckCircle, FileStack, ExternalLink, Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const DEFAULT_MODEL = "speedwolf2000/base-mark-v2";

const STATUS_COLOR = {
  succeeded: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  processing: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  starting: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  failed: "bg-red-500/15 text-red-300 border-red-500/30",
  canceled: "bg-muted text-muted-foreground border-border",
  succeeded2: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
};

function shortHash(h) {
  if (!h) return "—";
  return h.length > 14 ? `${h.slice(0, 7)}…${h.slice(-5)}` : h;
}

export default function ReplicatePanel() {
  const [modelInfo, setModelInfo] = useState(null);
  const [loadingModel, setLoadingModel] = useState(false);
  const [preds, setPreds] = useState([]);
  const [loadingPreds, setLoadingPreds] = useState(false);
  const [cancelling, setCancelling] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [uploadUrl, setUploadUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  const refreshModel = useCallback(async () => {
    setLoadingModel(true);
    try {
      const res = await base44.functions.invoke("replicateBaseMark", {
        action: "checkModel", model: DEFAULT_MODEL,
      });
      setModelInfo(res.data);
    } catch (e) {
      toast.error(`Model check failed: ${e.message}`);
    }
    setLoadingModel(false);
  }, []);

  const refreshPreds = useCallback(async () => {
    setLoadingPreds(true);
    try {
      const res = await base44.functions.invoke("replicateBaseMark", {
        action: "predictions",
      });
      setPreds(res.data?.results || []);
    } catch (e) {
      toast.error(`Predictions fetch failed: ${e.message}`);
    }
    setLoadingPreds(false);
  }, []);

  const refreshVersions = useCallback(async () => {
    setLoadingVersions(true);
    try {
      const res = await base44.functions.invoke("replicateBaseMark", {
        action: "versions", model: DEFAULT_MODEL,
      });
      setVersions(res.data?.results || []);
    } catch (e) {
      toast.error(`Versions fetch failed: ${e.message}`);
    }
    setLoadingVersions(false);
  }, []);

  useEffect(() => {
    refreshModel();
    refreshPreds();
    refreshVersions();
  }, [refreshModel, refreshPreds, refreshVersions]);

  const handleCancel = async (id) => {
    setCancelling(id);
    try {
      const res = await base44.functions.invoke("replicateBaseMark", {
        action: "cancel", id,
      });
      if (res.data?.ok) {
        toast.success(`Prediction ${res.data.status}`);
        setPreds((p) => p.map((x) => (x.id === id ? { ...x, status: res.data.status } : x)));
      } else {
        toast.error("Cancel failed");
      }
    } catch (e) {
      toast.error(`Cancel failed: ${e.message}`);
    }
    setCancelling(null);
  };

  const handleUpload = async () => {
    if (!uploadUrl.trim()) return toast.error("Paste an asset URL first");
    setUploading(true);
    setUploadResult(null);
    try {
      const res = await base44.functions.invoke("replicateBaseMark", {
        action: "uploadFile", fileUrl: uploadUrl.trim(), filename: "basemark-source.wav",
      });
      if (res.data?.ok) {
        setUploadResult(res.data);
        toast.success("Registered with Replicate Files API");
      } else {
        toast.error(res.data?.error || "Upload failed");
      }
    } catch (e) {
      toast.error(`Upload failed: ${e.message}`);
    }
    setUploading(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-bold text-muted-foreground uppercase mb-1 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-purple-400" /> Replicate · BASE Mark V2 Engine
          </h3>
          <p className="text-xs text-muted-foreground">Model status, live predictions, version history, file uploads</p>
        </div>
        <Button onClick={() => { refreshModel(); refreshPreds(); refreshVersions(); }}
          variant="outline" size="sm" className="rounded-xl gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* Model Status Card */}
      <div className="p-5 rounded-2xl bg-card border border-border space-y-3">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="text-base font-black text-foreground">{modelInfo?.model || DEFAULT_MODEL}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{modelInfo?.description || "—"}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`${modelInfo?.visibility === "private" ? "bg-amber-500/15 text-amber-300 border-amber-500/30" : "bg-muted text-muted-foreground border-border"}`}>
              <Shield className="w-3 h-3 mr-1" /> {modelInfo?.visibility || "—"}
            </Badge>
            {modelInfo?.run_count != null && (
              <Badge variant="outline" className="text-xs">{modelInfo.run_count.toLocaleString()} runs</Badge>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
          <div className="p-3 rounded-xl bg-muted/40 border border-border">
            <p className="text-[10px] text-muted-foreground uppercase mb-1">Live Version</p>
            <p className="text-xs font-mono text-cyan-300 break-all">{shortHash(modelInfo?.latest_version)}</p>
          </div>
          <div className="p-3 rounded-xl bg-muted/40 border border-border">
            <p className="text-[10px] text-muted-foreground uppercase mb-1">Pinned Version</p>
            <p className="text-xs font-mono text-foreground/80">Env: BASE_MARK_V2_VERSION</p>
            <p className="text-[10px] text-muted-foreground">unset → latest</p>
          </div>
          <div className="p-3 rounded-xl bg-muted/40 border border-border">
            <p className="text-[10px] text-muted-foreground uppercase mb-1">Default Example</p>
            <p className="text-xs font-mono text-muted-foreground">{shortHash(modelInfo?.default_example)}</p>
          </div>
        </div>
        {loadingModel && <p className="text-xs text-muted-foreground">Checking model…</p>}
        {modelInfo?.openapi_input_schema && (
          <details className="rounded-xl bg-muted/30 border border-border overflow-hidden">
            <summary className="cursor-pointer px-3 py-2 text-xs text-muted-foreground hover:bg-muted flex items-center gap-2">
              <FileStack className="w-3 h-3" /> Input schema (openapi)
            </summary>
            <pre className="px-3 py-2 text-[11px] text-muted-foreground overflow-x-auto border-t border-border max-h-48">{JSON.stringify(modelInfo.openapi_input_schema, null, 2)}</pre>
          </details>
        )}
      </div>

      {/* Predictions */}
      <div className="p-5 rounded-2xl bg-card border border-border">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" /> Recent Predictions
          </h4>
          {loadingPreds && <RefreshCw className="w-3 h-3 animate-spin text-muted-foreground" />}
        </div>
        {preds.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">No predictions returned.</p>
        ) : (
          <div className="space-y-2">
            {preds.slice(0, 12).map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/30 border border-border">
                <span className="text-xs font-mono text-muted-foreground flex-shrink-0 w-24 truncate">{shortHash(p.id)}</span>
                <Badge variant="outline" className={`text-xs ${STATUS_COLOR[p.status] || "bg-muted text-muted-foreground border-border"}`}>
                  {p.status}
                </Badge>
                <span className="text-[10px] text-muted-foreground flex-1 truncate">
                  {p.input?.audio || p.input?.message ? `audio · ${p.input?.action || "—"}` : "—"}
                </span>
                {p.completed_at && <span className="text-[10px] text-muted-foreground/70">{new Date(p.completed_at).toLocaleTimeString()}</span>}
                {(p.status === "starting" || p.status === "processing") && (
                  <button
                    onClick={() => handleCancel(p.id)}
                    disabled={cancelling === p.id}
                    className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1 disabled:opacity-50">
                    {cancelling === p.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />}
                    cancel
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Versions */}
      <div className="p-5 rounded-2xl bg-card border border-border">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5" /> Model Versions
          </h4>
          {loadingVersions && <RefreshCw className="w-3 h-3 animate-spin text-muted-foreground" />}
        </div>
        {versions.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">No versions returned.</p>
        ) : (
          <div className="space-y-2">
            {versions.slice(0, 10).map((v, i) => (
              <div key={v.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/30 border border-border">
                {i === 0 && <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-xs">latest</Badge>}
                <span className="text-xs font-mono text-cyan-300 flex-1 break-all">{shortHash(v.id)}</span>
                <span className="text-[10px] text-muted-foreground">{v.created_at ? new Date(v.created_at).toLocaleString() : "—"}</span>
                {v.cog_info?.image_visibility && (
                  <Badge variant="outline" className="text-[10px]">{v.cog_info.image_visibility}</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Helper */}
      <div className="p-5 rounded-2xl bg-card border border-border">
        <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
          <Upload className="w-3.5 h-3.5" /> Private File Registration (Replicate Files API)
        </h4>
        <p className="text-xs text-muted-foreground mb-3">
          Paste a Base44 (or public) URL for a track that's not publicly CORS-fetchable. Returns a Replicate-registered <code className="text-cyan-300">replicates://</code> URL you can use as the <code className="text-cyan-300">audio</code> model input.
        </p>
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            value={uploadUrl}
            onChange={(e) => setUploadUrl(e.target.value)}
            placeholder="https://files.base44.com/your-asset.wav"
            className="flex-1 min-w-64 rounded-xl border border-input bg-transparent px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <Button onClick={handleUpload} disabled={uploading} size="sm" className="rounded-xl gap-1.5">
            {uploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Register
          </Button>
        </div>
        {uploadResult && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1"
          >
            <div className="flex items-center gap-2 text-xs">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-emerald-300">Registered</span>
            </div>
            <p className="text-xs font-mono text-foreground break-all">{uploadResult.replicates_url}</p>
            <p className="text-[10px] text-muted-foreground">size: {uploadResult.size_bytes?.toLocaleString() || "?"} bytes</p>
          </motion.div>
        )}
      </div>

      {/* Webhook URL hint */}
      <div className="p-4 rounded-2xl bg-purple-500/5 border border-purple-500/20 flex items-start gap-3">
        <Link2 className="w-4 h-4 text-purple-300 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-purple-300">Webhook-driven completion</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            New <code>embed</code> requests automatically register a Replicate webhook when <code>REPLICATE_WEBHOOK_URL</code> is set in Base44 dashboard → Replicate POSTs the result here (verify with <code>?sig=</code>), eliminating the 2.5s polling loop. Until then, <code>pollBaseMarkV2</code> keeps the embed completing. To enable: open Base44 → Functions → <code>replicateV2Webhook</code> → copy the URL → paste into the <code>REPLICATE_WEBHOOK_URL</code> secret.
          </p>
        </div>
      </div>
    </div>
  );
}