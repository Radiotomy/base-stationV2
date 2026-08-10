import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { uploadToPinata } from '@/lib/studios/orvo/pinataUpload';
import { ORVO_CATEGORIES } from '@/lib/studios/orvo/manifest';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, ArrowRight, Loader2, ImagePlus, X } from 'lucide-react';

const STEPS = ['Details', 'Cover Art', 'Links'];

export default function CreatePodcast() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('other');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [coverCid, setCoverCid] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [twitterHandle, setTwitterHandle] = useState('');

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const { cid, gateway_url } = await uploadToPinata(file, `${title || 'podcast'}-cover`);
      setCoverUrl(gateway_url);
      setCoverCid(cid);
    } catch (err) {
      toast({ title: 'Cover upload failed', description: err.message, variant: 'destructive' });
    }
    setUploadingCover(false);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const podcast = await base44.entities.Podcast.create({
        user_id: user.id,
        user_name: user.full_name || '',
        orvo_studio_id: 'orvo',
        title: title.trim(),
        description: description.trim(),
        category,
        tags,
        cover_image: coverUrl,
        cover_ipfs_hash: coverCid,
        website_url: websiteUrl.trim(),
        twitter_handle: twitterHandle.trim().replace(/^@/, ''),
        is_active: true,
      });
      toast({ title: 'Podcast created 🎙️' });
      navigate(`/studios/orvo/podcast/${podcast.id}`);
    } catch (err) {
      toast({ title: 'Could not create podcast', description: err.message, variant: 'destructive' });
      setSubmitting(false);
    }
  };

  const canNext = step === 0 ? title.trim().length > 0 : true;
  const inputCls = 'w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF9A4D]/50';

  return (
    <div className="min-h-screen pb-16" style={{ backgroundColor: '#14100C' }}>
      <div className="max-w-2xl mx-auto px-6 pt-14">
        <Link to="/studios/orvo" className="text-sm text-white/50 hover:text-[#FF9A4D] flex items-center gap-1 mb-6">
          <ArrowLeft className="w-4 h-4" /> ORVO Studio
        </Link>
        <h1 className="font-display text-3xl text-white mb-2">Start a Podcast</h1>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full text-[11px] font-black flex items-center justify-center ${
                i <= step ? 'bg-[#FF9A4D] text-[#14100C]' : 'bg-white/10 text-white/40'
              }`}>{i + 1}</span>
              <span className={`text-xs font-bold ${i <= step ? 'text-white' : 'text-white/40'}`}>{label}</span>
              {i < STEPS.length - 1 && <span className="w-6 h-px bg-white/15" />}
            </div>
          ))}
        </div>

        <div className="merc-card rounded-2xl p-6 space-y-5">
          {step === 0 && (
            <>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-white/50 block mb-1.5">Title *</label>
                <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="My Podcast" maxLength={120} />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-white/50 block mb-1.5">Description</label>
                <textarea className={inputCls} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's your show about?" maxLength={2000} />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-white/50 block mb-1.5">Category</label>
                <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
                  {ORVO_CATEGORIES.map((c) => (
                    <option key={c} value={c} className="bg-[#14100C]">{c.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-white/50 block mb-1.5">Tags</label>
                <div className="flex gap-2">
                  <input
                    className={inputCls}
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                    placeholder="Add a tag, press Enter"
                  />
                  <button onClick={addTag} className="merc-button-dark rounded-lg px-4 text-sm font-bold">Add</button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {tags.map((t) => (
                      <span key={t} className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#FF9A4D]/10 text-[#FF9A4D] border border-[#FF9A4D]/30 flex items-center gap-1">
                        {t}
                        <button onClick={() => setTags(tags.filter((x) => x !== t))}><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {step === 1 && (
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-white/50 block mb-3">Cover Image (pinned to IPFS)</label>
              <label className="block aspect-square max-w-[240px] rounded-xl border-2 border-dashed border-white/15 hover:border-[#FF9A4D]/50 cursor-pointer transition-all overflow-hidden bg-black/30">
                {uploadingCover ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-[#FF9A4D] animate-spin" />
                  </div>
                ) : coverUrl ? (
                  <img src={coverUrl} alt="cover" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-white/40">
                    <ImagePlus className="w-8 h-8" />
                    <span className="text-xs font-bold">Upload cover</span>
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} disabled={uploadingCover} />
              </label>
              <p className="text-xs text-white/40 mt-3">Optional — you can add cover art later. Square images work best.</p>
            </div>
          )}

          {step === 2 && (
            <>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-white/50 block mb-1.5">Website (optional)</label>
                <input className={inputCls} value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://…" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-white/50 block mb-1.5">Twitter / X handle (optional)</label>
                <input className={inputCls} value={twitterHandle} onChange={(e) => setTwitterHandle(e.target.value)} placeholder="@myshow" />
              </div>
            </>
          )}

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
              className="merc-button-dark rounded-full px-5 py-2 text-sm font-bold disabled:opacity-40 flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canNext}
                className="merc-button rounded-full px-5 py-2 text-sm font-black disabled:opacity-40 flex items-center gap-1"
              >
                Next <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting || !title.trim()}
                className="merc-button rounded-full px-6 py-2 text-sm font-black disabled:opacity-40 flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Podcast
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}