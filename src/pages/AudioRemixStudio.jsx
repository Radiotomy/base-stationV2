import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Music, Upload, Zap, Save, ArrowLeft, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import AudioEditor from '@/components/audio/AudioEditor';
import MultiTrackMixer from '@/components/audio/MultiTrackMixer';

const EDIT_TASKS = [
  { value: 'extract_stems', label: 'Extract Stems', desc: 'Separate vocals, drums, instruments' },
  { value: 'remaster', label: 'Remaster', desc: 'Enhance & normalize audio' },
  { value: 'replace_section', label: 'Replace Section', desc: 'Swap a music segment' },
  { value: 'add_vocals', label: 'Add Vocals', desc: 'Add AI vocals to instrumental' },
  { value: 'add_instrumental', label: 'Add Instrumental', desc: 'Add backing track to vocals' }
];

export default function AudioRemixStudio() {
  const [activeTab, setActiveTab] = useState('upload');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [selectedTask, setSelectedTask] = useState('extract_stems');
  const [taskParams, setTaskParams] = useState('');
  const [stems, setStems] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [editedAudio, setEditedAudio] = useState(null);
  const [assetTitle, setAssetTitle] = useState('Edited Mix');

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessing(true);
    try {
      const result = await base44.integrations.Core.UploadFile({ file });
      setAudioUrl(result.file_url);
      setUploadedFile(file);
      setActiveTab('edit');
      toast.success('Audio uploaded!');
    } catch (error) {
      toast.error(error.message);
    }
    setProcessing(false);
  };

  const processAudio = async () => {
    if (!audioUrl) {
      toast.error('Upload audio first');
      return;
    }
    setProcessing(true);
    try {
      const result = await base44.functions.invoke('processMusicEdits', {
        task: selectedTask,
        audioUrl,
        parameters: taskParams ? JSON.parse(taskParams) : {}
      });
      
      if (selectedTask === 'extract_stems') {
        setStems(result.stems || []);
      } else {
        setEditedAudio(result.outputUrl);
      }
      toast.success('Audio processed!');
    } catch (error) {
      toast.error(error.message);
    }
    setProcessing(false);
  };

  const saveToLibrary = async () => {
    const urlToSave = editedAudio || audioUrl;
    if (!urlToSave) return;

    try {
      await base44.entities.UserAsset.create({
        user_id: (await base44.auth.me()).id,
        asset_type: 'track',
        title: assetTitle,
        file_url: urlToSave,
        is_public: false,
        metadata: { task: selectedTask, processed: !!editedAudio }
      });
      toast.success('Saved to library!');
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
      <div className="relative overflow-hidden pt-20 pb-12 px-6 bg-gradient-to-br from-blue-900/30 to-black">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-5xl font-black text-white mb-3 tracking-tight">🎛️ Audio Remix Studio</h1>
          <p className="text-white/60 text-lg">Extract stems, remaster, and edit audio tracks with AI-powered tools.</p>
        </div>
      </div>

      {/* Studio */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Control Panel */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
              <h3 className="font-black text-foreground">Edit Tools</h3>

              {/* File Upload */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Upload Audio</label>
                <label className="block cursor-pointer">
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div className="border-2 border-dashed border-border rounded-xl p-4 text-center hover:border-purple-500 transition-colors">
                    <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
                    <p className="text-xs text-muted-foreground">Click to upload</p>
                  </div>
                </label>
                {uploadedFile && <Badge className="bg-emerald-500/20 text-emerald-400 border-0 w-full justify-center">{uploadedFile.name}</Badge>}
              </div>

              {audioUrl && (
                <>
                  {/* Task Selection */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Edit Task</label>
                    <Select value={selectedTask} onValueChange={setSelectedTask}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EDIT_TASKS.map((task) => (
                          <SelectItem key={task.value} value={task.value}>
                            {task.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {EDIT_TASKS.find(t => t.value === selectedTask)?.desc}
                    </p>
                  </div>

                  {/* Task Parameters */}
                  {selectedTask === 'replace_section' && (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Parameters (JSON)</label>
                      <Textarea
                        value={taskParams}
                        onChange={(e) => setTaskParams(e.target.value)}
                        placeholder='{"startTime": 10, "endTime": 20, "newSegmentUrl": "..."}'
                        rows={2}
                        className="rounded-xl text-xs"
                      />
                    </div>
                  )}

                  {/* Process Button */}
                  <Button
                    onClick={processAudio}
                    disabled={processing}
                    className="w-full bg-blue-600 hover:bg-blue-500 rounded-xl font-bold gap-2"
                  >
                    {processing ? <Loader className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    {processing ? 'Processing…' : 'Process Audio'}
                  </Button>

                  {/* Asset Title */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Asset Title</label>
                    <Input
                      value={assetTitle}
                      onChange={(e) => setAssetTitle(e.target.value)}
                      className="rounded-xl text-xs"
                    />
                  </div>

                  <Button
                    onClick={saveToLibrary}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold gap-2"
                  >
                    <Save className="w-4 h-4" /> Save to Library
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Editor Panel */}
          <div className="lg:col-span-2 space-y-4">
            {audioUrl ? (
              <>
                <AudioEditor audioUrl={audioUrl} title="Audio Editor" />

                {/* Stems Display */}
                {stems.length > 0 && (
                  <div className="bg-card rounded-2xl border border-border p-6">
                    <h3 className="font-black text-foreground mb-4">🎚️ Extracted Stems</h3>
                    <MultiTrackMixer tracks={stems.map((url, i) => ({ id: i.toString(), name: `Stem ${i + 1}`, url }))} onChange={() => {}} />
                  </div>
                )}

                {/* Edited Output */}
                {editedAudio && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl border border-border p-6">
                    <h3 className="font-black text-foreground mb-4">✅ Processed Audio</h3>
                    <audio controls className="w-full mb-3" src={editedAudio} />
                    <Button className="w-full bg-blue-600 hover:bg-blue-500 rounded-xl">
                      Download
                    </Button>
                  </motion.div>
                )}
              </>
            ) : (
              <div className="bg-card rounded-2xl border border-dashed border-border p-12 flex flex-col items-center justify-center min-h-96">
                <Music className="w-12 h-12 text-muted-foreground mb-3 opacity-30" />
                <p className="text-muted-foreground">Upload audio to get started</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}