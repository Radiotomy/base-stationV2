import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { Link2 } from "lucide-react";

/**
 * Opt-in switch for automatic on-chain anchoring.
 *
 * Deliberately worded around permanence rather than convenience: an anchor
 * cannot be edited or removed once published, so the creator is told that
 * before they turn it on, not after.
 */
export default function AutoAnchorToggle({ user }) {
  const [enabled, setEnabled] = useState(!!user?.auto_anchor_provenance);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const change = async (next) => {
    setSaving(true);
    setEnabled(next);
    try {
      await base44.auth.updateMe({ auto_anchor_provenance: next });
      toast({
        title: next ? "Automatic registration on" : "Automatic registration off",
        description: next
          ? "New tracks, masters and mashups will be registered permanently as soon as they're created."
          : "You'll register works yourself, one at a time.",
      });
    } catch (e) {
      setEnabled(!next);
      toast({ title: "Couldn't save that", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <div className="merc-card rounded-2xl p-5 mb-6 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
          <Link2 className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <p className="font-bold">Register new work automatically</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Every new track, master and mashup gets its own permanent ownership record the moment
            it's created — no clicking required, and it's still free. A record can never be edited
            or removed once it exists, so this stays off until you switch it on.
          </p>
        </div>
      </div>
      <Switch checked={enabled} onCheckedChange={change} disabled={saving} />
    </div>
  );
}