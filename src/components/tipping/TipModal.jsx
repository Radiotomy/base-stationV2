import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Heart, Zap } from "lucide-react";

const PRESET_AMOUNTS = [1, 3, 5, 10, 25];

export default function TipModal({ artist, trackTitle, onClose }) {
  const [amount, setAmount] = useState(5);
  const [customAmount, setCustomAmount] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const finalAmount = customAmount ? parseFloat(customAmount) : amount;

  const handleTip = async () => {
    if (!finalAmount || finalAmount < 1) { toast.error("Minimum tip is $1"); return; }
    setSubmitting(true);
    const user = await base44.auth.me().catch(() => null);
    if (!user) { toast.error("Sign in to tip artists"); setSubmitting(false); return; }

    await base44.entities.Tip.create({
      from_user_id: user.id,
      from_user_name: user.full_name,
      from_user_email: user.email,
      to_artist_id: artist.id,
      to_artist_name: artist.name,
      to_artist_email: artist.email || "",
      amount_cents: Math.round(finalAmount * 100),
      currency: "usd",
      message,
      track_title: trackTitle || "",
      status: "completed",
    });

    // Log to activity feed
    base44.entities.ActivityFeedItem.create({
      type: "track_submitted",
      actor_name: user.full_name,
      actor_id: user.id,
      title: `tipped ${artist.name} $${finalAmount}`,
      description: message || "",
    }).catch(() => {});

    toast.success(`💸 You tipped ${artist.name} $${finalAmount}! They'll love it.`);
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black flex items-center gap-2">
            <Heart className="w-5 h-5 text-pink-400" /> Tip {artist.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 mt-2">
          {trackTitle && (
            <div className="p-3 rounded-xl bg-muted/60 border border-border text-sm text-muted-foreground">
              For: <span className="text-foreground font-semibold">{trackTitle}</span>
            </div>
          )}

          {/* Preset amounts */}
          <div>
            <Label className="mb-2 block">Choose Amount</Label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_AMOUNTS.map(a => (
                <button key={a} onClick={() => { setAmount(a); setCustomAmount(""); }}
                  className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${amount === a && !customAmount ? "bg-pink-600 border-pink-600 text-white" : "border-border text-muted-foreground hover:border-pink-500"}`}>
                  ${a}
                </button>
              ))}
            </div>
          </div>

          {/* Custom amount */}
          <div className="space-y-2">
            <Label>Custom Amount ($)</Label>
            <Input type="number" min="1" value={customAmount} onChange={e => setCustomAmount(e.target.value)}
              placeholder="Enter custom amount" className="rounded-xl" />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label>Leave a message <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input value={message} onChange={e => setMessage(e.target.value)} placeholder="This track is 🔥" className="rounded-xl" />
          </div>

          <Button onClick={handleTip} disabled={submitting || !finalAmount}
            className="w-full rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold py-3">
            {submitting ? "Processing…" : <><Zap className="w-4 h-4 mr-2" />Send ${finalAmount || "?"} Tip</>}
          </Button>

          <p className="text-xs text-center text-muted-foreground">Tips go directly to creators. No platform cut in Phase 2.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}