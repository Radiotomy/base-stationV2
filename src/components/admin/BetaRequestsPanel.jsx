import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { FlaskConical, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

/**
 * Admin panel — pending beta access requests. Approving sets
 * beta_access=true on the user, unlocking all beta studios.
 */
export default function BetaRequestsPanel() {
  const [requests, setRequests] = useState([]);
  const [busy, setBusy] = useState(null);

  const load = () =>
    base44.entities.BetaAccessRequest
      .filter({ status: "pending" }, "-created_date", 50)
      .then(setRequests)
      .catch(() => {});

  useEffect(() => { load(); }, []);

  const decide = async (req, approve) => {
    setBusy(req.id);
    try {
      if (approve) {
        await base44.entities.User.update(req.user_id, { beta_access: true });
      }
      await base44.entities.BetaAccessRequest.update(req.id, { status: approve ? "approved" : "denied" });
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
      toast.success(approve ? `Beta access granted to ${req.user_name || req.user_email}` : "Request denied");
    } catch {
      toast.error("Action failed — please try again");
    } finally {
      setBusy(null);
    }
  };

  if (requests.length === 0) return null;

  return (
    <div className="mb-6 p-5 rounded-2xl bg-amber-500/5 border border-amber-500/25">
      <div className="flex items-center gap-2 mb-4">
        <FlaskConical className="w-4 h-4 text-amber-400" />
        <h2 className="font-black text-foreground">Beta Access Requests</h2>
        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs">{requests.length} pending</Badge>
      </div>
      <div className="space-y-2">
        {requests.map((req) => (
          <div key={req.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-card border border-border flex-wrap">
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{req.user_name || req.user_email || "Unknown user"}</p>
              <p className="text-xs text-muted-foreground">
                Requested <span className="font-semibold text-foreground/80">{req.feature}</span>
                {req.created_date && <> · {new Date(req.created_date).toLocaleDateString()}</>}
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button size="sm" onClick={() => decide(req, true)} disabled={busy === req.id}
                title="Grant beta access — unlocks all beta studios for this user"
                className="h-8 rounded-lg gap-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold">
                <Check className="w-3.5 h-3.5" /> Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => decide(req, false)} disabled={busy === req.id}
                title="Deny this request — the user can request again later"
                className="h-8 rounded-lg gap-1 text-xs">
                <X className="w-3.5 h-3.5" /> Deny
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}