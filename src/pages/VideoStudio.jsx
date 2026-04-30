import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Film, Zap, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useJobPolling } from '@/hooks/useJobPolling';

const ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:3'];

export default function VideoStudio() {
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState('5');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [generating, setGenerating] = useState(false);
  const [jobId, setJobId] = useState('');
  const { status, progress, data } = useJobPolling(jobId);

  const generateVideo = async () => {
    if (!prompt) {
      toast.error('Enter a prompt');
      return;
    }
    setGenerating(true);
    try {
      const result = await base44.functions.invoke('generateVideoLTX', {
        prompt,
        duration: parseInt(duration),
        aspect_ratio: aspectRatio
      });
      setJobId(result.job_id);
      toast.success('Video generation started!');
    } catch (error) {
      toast.error(error.message);
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="relative overflow-hidden pt-20 pb-12 px-6 bg-gradient-to-br from-indigo-900/30 to-black">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-5xl font-black text-white mb-3 tracking-tight">🎬 Video Studio</h1>
          <p className="text-white/60 text-lg">Generate AI videos powered by LTX. Perfect for music visualizers and promos.</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-card rounded-2xl border border-border p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Video Prompt</label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the video you want to generate..."
              rows={4}
              className="rounded-xl"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Duration (seconds)</label>
              <input
                type="range"
                min="3"
                max="30"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground text-center">{duration}s</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Aspect Ratio</label>
              <Select value={aspectRatio} onValueChange={setAspectRatio}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASPECT_RATIOS.map((ar) => (
                    <SelectItem key={ar} value={ar}>
                      {ar}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={generateVideo}
            disabled={generating || status === 'processing'}
            className="w-full bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-lg py-6 gap-2"
          >
            <Zap className="w-5 h-5" />
            {status === 'processing' ? `Generating… ${progress}%` : 'Generate Video'}
          </Button>

          {data?.video_url && (
            <div className="bg-muted/40 rounded-xl p-4">
              <video
                controls
                className="w-full rounded-xl mb-3"
                src={data.video_url}
              />
              <Button className="w-full gap-2 rounded-xl">
                <Download className="w-4 h-4" /> Download Video
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}