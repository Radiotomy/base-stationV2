import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { uploadToPinata, extractAudioDuration } from '@/lib/studios/orvo/pinataUpload';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Loader2, FileAudio, ImagePlus } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

export default function UploadEpisode() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const [podcasts, setPodcasts] = useState([]);
  const [podcastId, setPodcastId] = useState(searchParams.get('podcast') || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [episodeNumber, setEpisodeNumber] = useState('');
  const [seasonNumber, setSeasonNumber] = useState('1');
  const [isPremium, setIsPremium] = useState(false);

  const [audioFile, setAudioFile] = useState(null);
  const [duration, setDuration] = useState(null);
  const [thumbUrl, setThumbUrl] = useState('');
  const [thumbCid, setThumbCid] = useState('');
  const [uploadingThumb, setUploadingThumb] = useState(false);

  const [phase, setPhase] = useState('idle'); // idle | uploading | saving

  useEffect(() => {
    if (!user) return;
    base44.entities.Podcast.filter({ user_id: user.id }, '-created_date', 100).then((rows) => {
      setPodcasts(rows || []);
      if (!podcastId && rows?.length === 1) setPodcastId(rows[0].id);
    });
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAudioSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioFile(file);
    setDuration(await extractAudioDuration(file));
  };

  const handleThumbUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingThumb(true);
    try {
      const { cid, gateway_url } = await uploadToPinata(file, `${title || 'episode'}-thumb`);
      setThumbUrl(gateway_url);
      setThumbCid(cid);
    } catch (err) {
      toast({ title: 'Thumbnail upload failed', description: err.message, variant: 'destructive' });
    }
    setUploadingThumb(false);
  };

  const save = async (publish) => {
    if (!podcastId || !title.trim() || !audioFile) return;
    setPhase('uploading');
    try {
      // Pin to IPFS AND keep a reliable Base44 storage copy in parallel.
      // Public IPFS gateways are rate-limited — the storage copy is what the
      // BASE Mark forensic pipeline downloads from, so marking never depends
      // on gateway availability.
      const [{ cid, gateway_url }, storageUpload] = await Promise.all([
        uploadToPinata(audioFile, `${title}-audio`),
        base44.integrations.Core.UploadFile({ file: audioFile }).catch(() => null),
      ]);
      setPhase('saving');
      const episode = await base44.entities.Episode.create({
        podcast_id: podcastId,
        user_id: user.id,
        title: title.trim(),
        description: description.trim(),
        episode_number: episodeNumber ? Number(episodeNumber) : undefined,
        season_number: seasonNumber ? Number(seasonNumber) : 1,
        audio_url: gateway_url,
        storage_audio_url: storageUpload?.file_url || undefined,
        ipfs_hash: cid,
        thumbnail_url: thumbUrl,
        thumbnail_ipfs_hash: thumbCid,
        duration_seconds: duration || undefined,
        is_premium: isPremium,
        status: publish ? 'published' : 'draft',
        published_date: publish ? new Date().toISOString() : undefined,
      });
      // Keep the show's episode count fresh
      const pod = podcasts.find((p) => p.id === podcastId);
      if (pod) {
        await base44.entities.Podcast.update(podcastId, { episode_count: (pod.episode_count || 0) + 1 });
      }
      // Auto-register provenance: COS score + BASE Mark cascade kick off in the
      // background so every uploaded episode is marked without a manual step.
      base44.functions.invoke('registerEpisodeProvenance', { episode_id: episode.id }).catch(() => {});
      toast({ title: publish ? 'Episode published 🎙️' : 'Draft saved', description: 'COS scoring & BASE Mark registration started in the background.' });
      navigate(`/studios/orvo/episode/${episode.id}`);
    } catch (err) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
      setPhase('idle');
    }
  };

  const busy = phase !== 'idle';
  const inputCls = 'w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF9A4D]/50';
  const canSave = podcastId && title.trim() && audioFile && !busy;

  return (
    <div className="min-h-screen pb-16" style={{ backgroundColor: '#14100C' }}>
      <div className="max-w-2xl mx-auto px-6 pt-14">
        <Link to="/studios/orvo" className="text-sm text-white/50 hover:text-[#FF9A4D] flex items-center gap-1 mb-6">
          <ArrowLeft className="w-4 h-4" /> ORVO Studio
        </Link>
        <h1 className="font-display text-3xl text-white mb-6">Upload Episode</h1>

        {podcasts.length === 0 ? (
          <div className="merc-card rounded-2xl p-8 text-center">
            <p className="text-white/60 mb-4">You need a podcast before uploading episodes.</p>
            <Link to="/studios/orvo/create-podcast" className="merc-button rounded-full px-6 py-2 text-sm font-black inline-block">
              Start a Podcast
            </Link>
          </div>
        ) : (
          <div className="merc-card rounded-2xl p-6 space-y-5">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-white/50 block mb-1.5">Podcast *</label>
              <select className={inputCls} value={podcastId} onChange={(e) => setPodcastId(e.target.value)}>
                <option value="" className="bg-[#14100C]">Select a podcast…</option>
                {podcasts.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#14100C]">{p.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-white/50 block mb-1.5">Episode Title *</label>
              <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="Episode title" />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-white/50 block mb-1.5">Description</label>
              <textarea className={inputCls} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} placeholder="What happens in this episode?" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-white/50 block mb-1.5">Episode #</label>
                <input className={inputCls} type="number" min="1" value={episodeNumber} onChange={(e) => setEpisodeNumber(e.target.value)} placeholder="1" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-white/50 block mb-1.5">Season #</label>
                <input className={inputCls} type="number" min="1" value={seasonNumber} onChange={(e) => setSeasonNumber(e.target.value)} />
              </div>
            </div>

            {/* Audio file */}
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-white/50 block mb-1.5">Audio File * (pinned to IPFS)</label>
              <label className="flex items-center gap-3 rounded-xl border-2 border-dashed border-white/15 hover:border-[#FF9A4D]/50 cursor-pointer transition-all p-4 bg-black/30">
                <FileAudio className="w-8 h-8 text-[#FF9A4D] flex-shrink-0" />
                <div className="min-w-0">
                  {audioFile ? (
                    <>
                      <p className="text-sm font-bold text-white truncate">{audioFile.name}</p>
                      <p className="text-xs text-white/50">
                        {(audioFile.size / 1024 / 1024).toFixed(1)} MB{duration ? ` · ${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}` : ''}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-white/50">Choose an audio file (MP3, WAV, M4A…)</p>
                  )}
                </div>
                <input type="file" accept="audio/*" className="hidden" onChange={handleAudioSelect} disabled={busy} />
              </label>
            </div>

            {/* Thumbnail */}
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-white/50 block mb-1.5">Thumbnail (optional)</label>
              <label className="flex items-center gap-3 rounded-xl border border-white/10 hover:border-[#FF9A4D]/40 cursor-pointer transition-all p-3 bg-black/20">
                {uploadingThumb ? (
                  <Loader2 className="w-6 h-6 text-[#FF9A4D] animate-spin" />
                ) : thumbUrl ? (
                  <img src={thumbUrl} alt="thumb" className="w-10 h-10 rounded-lg object-cover" />
                ) : (
                  <ImagePlus className="w-6 h-6 text-white/40" />
                )}
                <span className="text-sm text-white/50">{thumbUrl ? 'Replace thumbnail' : 'Upload thumbnail'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleThumbUpload} disabled={uploadingThumb || busy} />
              </label>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 p-3.5">
              <div>
                <p className="text-sm font-bold text-white">Premium episode</p>
                <p className="text-xs text-white/50">Reserved for paid subscribers (monetization v2.0)</p>
              </div>
              <Switch checked={isPremium} onCheckedChange={setIsPremium} disabled={busy} />
            </div>

            {busy && (
              <div className="flex items-center gap-3 rounded-xl bg-[#FF9A4D]/10 border border-[#FF9A4D]/30 p-3.5">
                <Loader2 className="w-5 h-5 text-[#FF9A4D] animate-spin flex-shrink-0" />
                <p className="text-sm text-[#FF9A4D] font-bold">
                  {phase === 'uploading' ? 'Uploading & pinning to IPFS…' : 'Saving episode…'}
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-1">
              <button onClick={() => save(false)} disabled={!canSave} className="merc-button-dark rounded-full px-5 py-2 text-sm font-bold disabled:opacity-40">
                Save Draft
              </button>
              <button onClick={() => save(true)} disabled={!canSave} className="merc-button rounded-full px-6 py-2 text-sm font-black disabled:opacity-40">
                Publish
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}