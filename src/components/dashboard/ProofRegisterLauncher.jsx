import { useState } from "react";
import { Plus, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import RegisterTrackOnBaseModal from "@/components/solana/RegisterTrackOnBaseModal";

/**
 * "Register a Track" entry point for the Proof of Ownership tab.
 * Lets the user pick one of their track assets, then opens the
 * registration flow (platform-sponsored, no crypto required).
 */
export default function ProofRegisterLauncher({ assets = [], user, registeredTitles = [], onRegistered }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState(null);

  const trackAssets = assets.filter((a) => a.asset_type === "track" && a.file_url);

  const pick = (asset) => {
    const m = asset.metadata || {};
    setSelectedTrack({
      title: asset.title,
      track_url: asset.file_url,
      cover_image_url: asset.thumbnail_url || "",
      genre: m.genre || "",
      ai_tools_used: m.provider || "",
      ai_label: asset.ai_label || undefined,
      description: asset.description || "",
      asset_id: asset.id,
    });
    setPickerOpen(false);
  };

  return (
    <>
      <Button
        onClick={() => setPickerOpen(true)}
        title="Create a permanent, tamper-proof ownership record for one of your tracks — free, no wallet needed"
        className="rounded-xl gap-2 bg-blue-600 hover:bg-blue-500 text-sm font-bold"
      >
        <Plus className="w-4 h-4" /> Register a Track
      </Button>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>Pick a track to register</DialogTitle>
          </DialogHeader>
          {trackAssets.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No tracks in your library yet — generate one in the Music Studio first.
            </p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {trackAssets.map((a) => {
                const already = registeredTitles.includes(a.title);
                return (
                  <button
                    key={a.id}
                    onClick={() => !already && pick(a)}
                    disabled={already}
                    title={already ? "This track is already registered" : `Register "${a.title}"`}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                      already
                        ? "border-border/40 opacity-50 cursor-not-allowed"
                        : "border-border hover:border-blue-500/40 hover:bg-blue-500/5"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
                      {a.thumbnail_url
                        ? <img src={a.thumbnail_url} alt={a.title} className="w-full h-full object-cover" />
                        : <Music className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground truncate">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{already ? "Already registered ✓" : a.metadata?.genre || "track"}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {selectedTrack && (
        <RegisterTrackOnBaseModal
          track={selectedTrack}
          user={user}
          onClose={() => setSelectedTrack(null)}
          onSubmitted={() => { setSelectedTrack(null); onRegistered?.(); }}
        />
      )}
    </>
  );
}