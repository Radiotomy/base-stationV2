import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Upload, Music, Download, Save, Trash2, Copy, Music2, Image as ImageIcon, Loader } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const STANDARD_TAGS = [
  { key: "artist", label: "Artist", placeholder: "Artist name" },
  { key: "title", label: "Title", placeholder: "Song title" },
  { key: "album", label: "Album", placeholder: "Album name" },
  { key: "year", label: "Year", placeholder: "2026" },
  { key: "genre", label: "Genre", placeholder: "Genre" },
  { key: "track", label: "Track #", placeholder: "1" },
  { key: "albumArtist", label: "Album Artist", placeholder: "Album artist" },
  { key: "composer", label: "Composer", placeholder: "Composer" },
];

export default function ID3TagStudio() {
  const [activeMode, setActiveMode] = useState("upload"); // "upload" | "library"
  const [uploadedFile, setUploadedFile] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [tags, setTags] = useState({});
  const [coverImage, setCoverImage] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [libraryAssets, setLibraryAssets] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      base44.entities.UserAsset.filter({ user_id: u.id, asset_type: "track" }, "-created_date", 50)
        .then(setLibraryAssets)
        .catch(() => {});
    }).catch(() => {});
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["audio/mpeg", "audio/wav"].includes(file.type)) {
      toast.error("Only MP3 and WAV files supported");
      return;
    }
    setUploadedFile(file);
    setFileUrl(URL.createObjectURL(file));
    setTags({ title: file.name.replace(/\.[^.]+$/, "") });
    toast.success("File loaded");
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await base44.integrations.Core.UploadFile({ file: file });
      setCoverImage(res.file_url);
      toast.success("Cover image set");
    } catch (err) {
      toast.error("Failed to upload cover: " + err.message);
    }
  };

  const loadAssetTags = (asset) => {
    setSelectedAsset(asset);
    setFileUrl(asset.file_url);
    setTags({
      title: asset.title,
      artist: asset.metadata?.artist || "",
      album: asset.metadata?.album || "",
      genre: asset.metadata?.genre || "",
      year: asset.metadata?.year || new Date().getFullYear(),
      track: asset.metadata?.track || "",
      albumArtist: asset.metadata?.albumArtist || "",
      composer: asset.metadata?.composer || "",
    });
    if (asset.thumbnail_url) setCoverImage(asset.thumbnail_url);
    setActiveMode("library");
  };

  const updateTag = (key, value) => {
    setTags(prev => ({ ...prev, [key]: value }));
  };

  const saveTags = async () => {
    if (!fileUrl) {
      toast.error("Select a file first");
      return;
    }
    setProcessing(true);
    try {
      const res = await base44.functions.invoke("editID3Tags", {
        audio_url: fileUrl,
        tags: {
          ...tags,
          year: parseInt(tags.year) || new Date().getFullYear(),
          track: parseInt(tags.track) || 0,
        },
        cover_image_url: coverImage,
      });
      if (res.data?.download_url) {
        toast.success("Tags saved! Ready to download.");
        const a = document.createElement("a");
        a.href = res.data.download_url;
        a.download = `${tags.title || "track"}.mp3`;
        a.click();
        toast.success("File downloaded!");
      } else {
        toast.error("Failed to process file");
      }
    } catch (err) {
      toast.error(err.message);
    }
    setProcessing(false);
  };

  const copyTag = (key) => {
    navigator.clipboard.writeText(tags[key] || "");
    toast.success("Copied!");
  };

  const clearTags = () => {
    setTags({});
    setCoverImage(null);
    setFileUrl(null);
    setUploadedFile(null);
    setSelectedAsset(null);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="fixed top-0 inset-x-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50 px-6 h-14 flex items-center">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-semibold">Back</span>
        </Link>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden pt-20 pb-12 px-6 bg-gradient-to-br from-purple-900/30 to-black">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-5xl font-black text-white mb-3 tracking-tight">🏷️ ID3 Tag Studio</h1>
          <p className="text-white/60 text-lg">Edit, create, and manage ID3v2.4 metadata for MP3 and WAV files.</p>
        </div>
      </div>

      {/* Studio */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Mode Selector */}
        <div className="flex gap-3 mb-8">
          <Button
            variant={activeMode === "upload" ? "default" : "outline"}
            className="rounded-xl gap-2 font-bold"
            onClick={() => { setActiveMode("upload"); clearTags(); }}
          >
            <Upload className="w-4 h-4" /> Upload File
          </Button>
          <Button
            variant={activeMode === "library" ? "default" : "outline"}
            className="rounded-xl gap-2 font-bold"
            onClick={() => setActiveMode("library")}
          >
            <Music2 className="w-4 h-4" /> From Library
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: File/Library Selection */}
          <div className="lg:col-span-1 space-y-4">
            {activeMode === "upload" ? (
              <div className="border-2 border-dashed border-border rounded-2xl p-6 text-center hover:border-purple-500/50 transition-colors">
                <input
                  type="file"
                  accept="audio/mpeg,audio/wav,.mp3,.wav"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="audio-upload"
                />
                <label htmlFor="audio-upload" className="cursor-pointer block">
                  <Music className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="font-bold text-foreground">Drop MP3 or WAV</p>
                  <p className="text-xs text-muted-foreground mt-1">Click to browse</p>
                </label>
              </div>
            ) : (
              <div className="bg-card rounded-2xl border border-border p-4 space-y-3 max-h-96 overflow-y-auto">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Your Tracks</p>
                {libraryAssets.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No tracks in library</p>
                ) : (
                  libraryAssets.map(asset => (
                    <button
                      key={asset.id}
                      onClick={() => loadAssetTags(asset)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${selectedAsset?.id === asset.id ? "bg-purple-500/20 border-purple-500" : "bg-muted/30 border-border hover:border-purple-500/30"}`}
                    >
                      <p className="text-sm font-bold text-foreground truncate">{asset.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{asset.metadata?.genre || "No genre"}</p>
                    </button>
                  ))
                )}
              </div>
            )}

            {fileUrl && (
              <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Cover Art</p>
                {coverImage ? (
                  <div className="relative">
                    <img src={coverImage} alt="Cover" className="w-full rounded-xl" />
                    <button onClick={() => setCoverImage(null)}
                      className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-black/50 flex items-center justify-center text-white hover:bg-black/70">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="block p-4 rounded-xl border-2 border-dashed border-border text-center cursor-pointer hover:border-purple-500/50">
                    <input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
                    <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Upload cover art</p>
                  </label>
                )}
              </div>
            )}
          </div>

          {/* Right: Tag Editor */}
          {fileUrl && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-2 space-y-4">
              <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-foreground text-lg">Edit Tags</h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={clearTags}
                    className="text-xs gap-1 text-muted-foreground"
                  >
                    <Trash2 className="w-3 h-3" /> Clear
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                  {STANDARD_TAGS.map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1.5">
                        {label}
                      </label>
                      <div className="flex gap-2">
                        <Input
                          value={tags[key] || ""}
                          onChange={(e) => updateTag(key, e.target.value)}
                          placeholder={placeholder}
                          className="rounded-lg text-xs flex-1"
                        />
                        <button
                          onClick={() => copyTag(key)}
                          className="w-9 h-9 flex items-center justify-center rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                          title="Copy"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1.5">
                    Comments / Description
                  </label>
                  <Textarea
                    value={tags.comment || ""}
                    onChange={(e) => updateTag("comment", e.target.value)}
                    placeholder="Add comments or notes…"
                    rows={3}
                    className="rounded-lg text-xs"
                  />
                </div>

                {Object.keys(tags).filter(k => tags[k]).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(tags).filter(([, v]) => v).map(([k, v]) => (
                      <Badge key={k} variant="outline" className="text-xs">
                        {k}: <span className="font-bold ml-1">{String(v).slice(0, 20)}</span>
                      </Badge>
                    ))}
                  </div>
                )}

                <Button
                  onClick={saveTags}
                  disabled={processing}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold gap-2 text-base py-5"
                >
                  {processing ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {processing ? "Processing…" : "Save & Download"}
                </Button>
              </div>

              {/* Info */}
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 space-y-1">
                <p className="font-semibold">ℹ️ About ID3v2.4:</p>
                <p>• Standard metadata format for MP3 files</p>
                <p>• Supports unicode text & album artwork</p>
                <p>• WAV files will be converted to MP3</p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}