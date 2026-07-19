import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { CheckCircle, Clock, AlertCircle, ExternalLink, FileLock2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const STATUS_STYLES = {
  registered: { icon: CheckCircle, cls: "bg-green-500/15 text-green-400 border-green-500/30" },
  pending: { icon: Clock, cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  failed: { icon: AlertCircle, cls: "bg-red-500/15 text-red-400 border-red-500/30" },
};

const gatewayFromUri = (uri) =>
  uri?.startsWith("ipfs://") ? `https://gateway.pinata.cloud/ipfs/${uri.slice(7)}` : uri;

export default function BaseRegistryRow({ record, onChanged }) {
  const [txInput, setTxInput] = useState("");
  const [busy, setBusy] = useState("");

  const s = STATUS_STYLES[record.registration_status] || STATUS_STYLES.pending;
  const StatusIcon = s.icon;

  const run = async (label, payload, successMsg) => {
    setBusy(label);
    try {
      await base44.functions.invoke("registerOnBase", { registry_id: record.id, ...payload });
      toast.success(successMsg);
      onChanged?.();
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message || "Action failed");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="p-4 rounded-xl bg-card border border-border space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-foreground truncate">{record.track_title}</p>
            <Badge className={`${s.cls} gap-1 text-[10px]`}><StatusIcon className="w-3 h-3" /> {record.registration_status}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {record.artist_name} · {new Date(record.created_date).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {record.metadata_uri && (
            <a href={gatewayFromUri(record.metadata_uri)} target="_blank" rel="noopener noreferrer"
              className="text-cyan-400 text-xs hover:underline flex items-center gap-1">
              <FileLock2 className="w-3 h-3" /> IPFS
            </a>
          )}
          {record.transaction_hash && (
            <a href={`https://basescan.org/tx/${record.transaction_hash}`} target="_blank" rel="noopener noreferrer"
              className="text-blue-400 text-xs hover:underline flex items-center gap-1">
              <ExternalLink className="w-3 h-3" /> Basescan
            </a>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-2 text-[11px] font-mono text-muted-foreground">
        <p className="truncate">fp: {record.fingerprint_hash ? `${record.fingerprint_hash.slice(0, 24)}…` : "—"}</p>
        <p className="truncate">uri: {record.metadata_uri || <span className="text-red-400">missing</span>}</p>
      </div>

      {record.registration_status !== "registered" && (
        <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-border/60">
          <Input
            value={txInput}
            onChange={(e) => setTxInput(e.target.value.trim())}
            placeholder="0x… tx hash to confirm"
            className="h-8 text-xs font-mono flex-1 min-w-[220px]"
          />
          <Button
            size="sm" className="h-8 rounded-lg bg-blue-600 hover:bg-blue-500 gap-1.5"
            disabled={!!busy || !/^0x[0-9a-fA-F]{64}$/.test(txInput)}
            onClick={() => run("confirm", { action: "admin_update", registration_status: "registered", transaction_hash: txInput }, "Marked as registered")}
          >
            {busy === "confirm" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />} Confirm
          </Button>
          {!record.metadata_uri && (
            <Button
              size="sm" variant="outline" className="h-8 rounded-lg gap-1.5" disabled={!!busy}
              onClick={() => run("repin", { action: "admin_repin" }, "Re-pinned to IPFS")}
            >
              {busy === "repin" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Re-pin IPFS
            </Button>
          )}
          {record.registration_status !== "failed" && (
            <Button
              size="sm" variant="outline" className="h-8 rounded-lg text-red-400 hover:text-red-300 gap-1.5" disabled={!!busy}
              onClick={() => run("fail", { action: "admin_update", registration_status: "failed" }, "Marked as failed")}
            >
              {busy === "fail" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertCircle className="w-3.5 h-3.5" />} Fail
            </Button>
          )}
        </div>
      )}
    </div>
  );
}