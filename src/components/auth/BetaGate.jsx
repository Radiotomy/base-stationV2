import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Lock, Send, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Beta access gate — renders children only if the user is an admin or has
 * been granted beta_access by an admin. Otherwise shows a locked screen
 * where the user can request access (reviewed in Admin → Users).
 */
export default function BetaGate({ feature, children }) {
  const { user } = useAuth();
  const [request, setRequest] = useState(null);
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const hasAccess = !!user && (user.role === "admin" || user.beta_access || user.data?.beta_access);

  useEffect(() => {
    if (!user || hasAccess) { setChecking(false); return; }
    base44.entities.BetaAccessRequest
      .filter({ user_id: user.id }, "-created_date", 5)
      .then((reqs) => setRequest(reqs.find((r) => r.feature === feature) || null))
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [user, hasAccess, feature]);

  if (hasAccess) return children;

  if (checking) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#FF9A4D]/30 border-t-[#FF9A4D] rounded-full animate-spin" />
      </div>
    );
  }

  const requestAccess = async () => {
    setSubmitting(true);
    try {
      const created = await base44.entities.BetaAccessRequest.create({
        user_id: user.id,
        user_name: user.full_name || "",
        user_email: user.email || "",
        feature,
        status: "pending",
      });
      setRequest(created);
      toast.success("Request sent — you'll get access once it's approved");
    } catch {
      toast.error("Couldn't send the request — please try again");
    } finally {
      setSubmitting(false);
    }
  };

  const pending = request?.status === "pending";
  const denied = request?.status === "denied";

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center merc-card rounded-3xl p-8">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6 text-amber-400" />
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400 mb-2">Beta Access</p>
        <h1 className="text-2xl font-black text-foreground mb-2">{feature} is in Beta</h1>
        <p className="text-sm text-muted-foreground mb-6">
          This studio is currently limited to approved beta testers. Request access below and
          an admin will review it — you'll be able to jump in as soon as you're approved.
        </p>

        {pending ? (
          <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/25 text-yellow-300 text-sm font-semibold">
            <Clock className="w-4 h-4" /> Request pending review
          </div>
        ) : denied ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-sm font-semibold">
              <XCircle className="w-4 h-4" /> Your previous request wasn't approved
            </div>
            <Button onClick={requestAccess} disabled={submitting} variant="outline" className="rounded-xl gap-2 w-full">
              <Send className="w-4 h-4" /> {submitting ? "Sending…" : "Request Again"}
            </Button>
          </div>
        ) : (
          <Button onClick={requestAccess} disabled={submitting} className="rounded-xl gap-2 w-full merc-button font-bold">
            <Send className="w-4 h-4" /> {submitting ? "Sending…" : "Request Beta Access"}
          </Button>
        )}
      </div>
    </div>
  );
}