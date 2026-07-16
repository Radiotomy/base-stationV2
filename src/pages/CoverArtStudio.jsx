import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Palette, Download, RefreshCw, Save, ArrowLeft, Copy, Zap, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import ChipSelector from '@/components/music/ChipSelector';
import { handleCreditError, refreshCreditsFromResponse } from '@/utils/creditErrors';
import CostBadge from '@/components/credits/CostBadge';
import InfoTip from '@/components/common/InfoTip';
import { calculateHumanParticipationScore } from '@/utils/participationScore';

const GENRES = ['Hip-Hop', 'EDM', 'Pop', 'R&B', 'Rock', 'Lo-Fi', 'Jazz', 'Classical', 'Trap', 'Other'];
const MOODS = ['Happy', 'Sad', 'Energetic', 'Chill', 'Dark', 'Uplifting', 'Romantic', 'Angry'];
const STYLES = ['Abstract', 'Realistic', 'Minimalist', 'Surreal', 'Vintage', 'Futuristic', 'Geometric', 'Organic'];

export default function CoverArtStudio() {
  const [activeMode, setActiveMode] = useState('cheap');
  const [genre, setGenre] = useState('Hip-Hop');
  const [mood, setMood] = useState('Energetic');
  const [style, setStyle] = useState('Abstract');
  const [customPrompt, setCustomPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedArt, setGeneratedArt] = useState(null);
  const [variations, setVariations] = useState([]);
  const [selectedVariation, setSelectedVariation] = useState(null);
  const [title, setTitle] = useState('Untitled Artwork');

  const generateCheapArt = async () => {
    setGenerating(true);
    try {
      const prompt = `Genre: ${genre}, Mood: ${mood}, Style: ${style}, professional album cover art, vibrant, high quality`;
      const res = await base44.functions.invoke('generateCoverArtTiered', {
        prompt,
        quality: 'cheap'
      });
      const url = res.data?.image_url;
      setGeneratedArt(url);
      setVariations([url]);
      setSelectedVariation(url);
      refreshCreditsFromResponse(res.data);
      toast.success('Cover art generated!');
    } catch (error) {
      if (!handleCreditError(error)) toast.error(error?.response?.data?.message || error.message);
    }
    setGenerating(false);
  };

  const generateCustomArt = async () => {
    if (!customPrompt) {
      toast.error('Enter a prompt');
      return;
    }
    setGenerating(true);
    try {
      const res = await base44.functions.invoke('generateCoverArtTiered', {
        prompt: customPrompt,
        quality: 'modest'
      });
      const url = res.data?.image_url;
      setGeneratedArt(url);
      setVariations([url]);
      setSelectedVariation(url);
      refreshCreditsFromResponse(res.data);
      toast.success('Custom cover art generated!');
    } catch (error) {
      if (!handleCreditError(error)) toast.error(error?.response?.data?.message || error.message);
    }
    setGenerating(false);
  };

  const generateVariations = async () => {
    setGenerating(true);
    try {
      const prompt = activeMode === 'cheap' 
        ? `Genre: ${genre}, Mood: ${mood}, Style: ${style}, professional album cover art, vibrant`
        : customPrompt;
      const quality = activeMode === 'cheap' ? 'cheap' : 'modest';

      // Generate 3 variations
      const results = await Promise.all([
        base44.functions.invoke('generateCoverArtTiered', { prompt, quality }),
        base44.functions.invoke('generateCoverArtTiered', { prompt, quality }),
        base44.functions.invoke('generateCoverArtTiered', { prompt, quality })
      ]);

      const urls = results.map(r => r.data?.image_url).filter(Boolean);
      setVariations(urls);
      setSelectedVariation(urls[0]);
      setGeneratedArt(urls[0]);
      // Refresh credits from the last response (cumulative balance is correct)
      refreshCreditsFromResponse(results[results.length - 1]?.data);
      toast.success(`${urls.length} variations generated!`);
    } catch (error) {
      if (!handleCreditError(error)) toast.error(error?.response?.data?.message || error.message);
    }
    setGenerating(false);
  };

  const saveArt = async () => {
    if (!selectedVariation) {
      toast.error('Select an artwork first');
      return;
    }
    try {
      const participation = calculateHumanParticipationScore({
        userProvidedContent: false,
        prompt: activeMode === 'modest' ? customPrompt : '',
        styleOrTags: activeMode === 'cheap' ? [genre, mood, style] : [],
        isIteration: variations.length > 1,
      });
      await base44.entities.UserAsset.create({
        user_id: (await base44.auth.me()).id,
        asset_type: 'coverart',
        title,
        file_url: selectedVariation,
        is_public: false,
        ai_disclosure_label: participation.label,
        ai_disclosure_basis: participation.basis,
        human_participation_score: participation.score,
        participation_signals: participation.signals,
        metadata: { genre, mood, style, prompt: customPrompt || 'auto-generated' }
      });
      toast.success('Cover art saved to library!');
    } catch (error) {
      toast.error(error.message);
    }
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
          <h1 className="text-5xl font-black text-white mb-3 tracking-tight">🎨 Cover Art Studio</h1>
          <p className="text-white/60 text-lg">Generate professional album artwork. Cheap auto-generated or custom high-quality designs.</p>
        </div>
      </div>

      {/* Studio */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Controls Panel */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
              <h3 className="font-black text-foreground flex items-center gap-2">
                Generation Mode
                <InfoTip text="Cheap = quick chip-based covers (1 credit). Modest = custom prompt for higher-quality, intentional designs (3 credits)." />
              </h3>

              <div className="flex gap-2">
                <Button
                  variant={activeMode === 'cheap' ? 'default' : 'outline'}
                  className="flex-1 rounded-xl text-xs h-8"
                  onClick={() => setActiveMode('cheap')}
                  title="1 credit — auto-generated from chips"
                >
                  💰 Cheap
                </Button>
                <Button
                  variant={activeMode === 'modest' ? 'default' : 'outline'}
                  className="flex-1 rounded-xl text-xs h-8"
                  onClick={() => setActiveMode('modest')}
                  title="3 credits — custom prompt, higher quality"
                >
                  ✨ Modest
                </Button>
              </div>

              {activeMode === 'cheap' ? (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Genre</label>
                    <ChipSelector
                      chipType="genre"
                      defaults={GENRES}
                      selected={genre}
                      onSelect={setGenre}
                      activeClass="bg-purple-600 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Mood</label>
                    <ChipSelector
                      chipType="mood"
                      defaults={MOODS}
                      selected={mood}
                      onSelect={setMood}
                      activeClass="bg-pink-600 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Style</label>
                    <ChipSelector
                      chipType="style"
                      defaults={STYLES}
                      selected={style}
                      onSelect={setStyle}
                      activeClass="bg-indigo-600 text-white"
                    />
                  </div>

                  <Button
                    onClick={generateCheapArt}
                    disabled={generating}
                    className="w-full bg-purple-600 hover:bg-purple-500 rounded-xl font-bold gap-2"
                  >
                    {generating ? <Loader className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    {generating ? 'Generating…' : 'Generate'}
                    {!generating && <CostBadge cost={1} size="sm" />}
                  </Button>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                      Custom Prompt
                      <InfoTip text="Reference a real visual style for best results — e.g. 'in the style of a 1972 Blue Note jazz cover, deep blacks, warm typography'. Be specific about colors, era, and focal point." />
                    </label>
                    <Textarea
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder="Describe your ideal album cover..."
                      rows={4}
                      className="rounded-xl text-xs"
                    />
                  </div>

                  <Button
                    onClick={generateCustomArt}
                    disabled={generating || !customPrompt}
                    className="w-full bg-purple-600 hover:bg-purple-500 rounded-xl font-bold gap-2"
                  >
                    {generating ? <Loader className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    {generating ? 'Generating…' : 'Generate Custom'}
                    {!generating && <CostBadge cost={3} size="sm" />}
                  </Button>
                </>
              )}

              {generatedArt && (
                <>
                  <Button
                    onClick={generateVariations}
                    disabled={generating}
                    variant="outline"
                    className="w-full rounded-xl gap-2"
                  >
                    <RefreshCw className="w-4 h-4" /> Generate Variations
                  </Button>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Asset Title</label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="My Cover Art"
                      className="rounded-xl text-xs"
                    />
                  </div>

                  <Button
                    onClick={saveArt}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold gap-2"
                  >
                    <Save className="w-4 h-4" /> Save to Library
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Preview Panel */}
          <div className="lg:col-span-2 space-y-4">
            {generatedArt ? (
              <>
                <div className="bg-card rounded-2xl border border-border p-6">
                  <h3 className="font-black text-foreground mb-4">Preview</h3>
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="aspect-square rounded-xl overflow-hidden bg-muted mb-4">
                    <img src={selectedVariation} alt="Cover Art" className="w-full h-full object-cover" />
                  </motion.div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 rounded-xl gap-1.5"
                      onClick={() => {
                        const a = document.createElement('a');
                        a.href = selectedVariation;
                        a.download = `${title}.jpg`;
                        a.click();
                      }}
                    >
                      <Download className="w-4 h-4" /> Download
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 rounded-xl gap-1.5"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedVariation);
                        toast.success('URL copied!');
                      }}
                    >
                      <Copy className="w-4 h-4" /> Copy URL
                    </Button>
                  </div>
                </div>

                {variations.length > 1 && (
                  <div className="bg-card rounded-2xl border border-border p-6">
                    <h3 className="font-black text-foreground mb-3">Variations</h3>
                    <div className="grid grid-cols-3 gap-3">
                      {variations.map((v, i) => (
                        <motion.button
                          key={i}
                          onClick={() => setSelectedVariation(v)}
                          className={`aspect-square rounded-xl overflow-hidden border-2 transition-all ${selectedVariation === v ? 'border-purple-500' : 'border-border'}`}
                          whileHover={{ scale: 1.05 }}
                        >
                          <img src={v} alt={`Variation ${i + 1}`} className="w-full h-full object-cover" />
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-card rounded-2xl border border-dashed border-border p-12 flex flex-col items-center justify-center text-center min-h-96">
                <Palette className="w-12 h-12 text-muted-foreground mb-3 opacity-30" />
                <p className="text-muted-foreground">Select options and generate cover art to get started</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}