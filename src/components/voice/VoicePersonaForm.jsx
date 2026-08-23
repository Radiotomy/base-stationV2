import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Play, Loader } from 'lucide-react';
import { toast } from 'sonner';

const VOICE_TYPES = ['male', 'female', 'neutral'];
const AGES = ['child', 'teen', 'adult', 'senior'];
const ACCENTS = ['american', 'british', 'australian', 'neutral', 'other'];
const CHARACTERISTICS = ['raspy', 'breathy', 'smooth', 'monotone', 'expressive', 'deep', 'high', 'nasal', 'warm'];

export default function VoicePersonaForm({ persona, onSave, onCancel }) {
  const [formData, setFormData] = useState(persona || {
    name: '',
    description: '',
    voice_type: 'male',
    age: 'adult',
    accent: 'neutral',
    characteristics: [],
    sample_url: '',
    provider: 'elevenlabs',
    tags: []
  });

  const [selectedCharacteristics, setSelectedCharacteristics] = useState(persona?.characteristics || []);
  const [generating, setGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState(persona?.sample_url || '');
  const audioRef = useRef(null);

  const handleInputChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const toggleCharacteristic = (char) => {
    const newChars = selectedCharacteristics.includes(char)
      ? selectedCharacteristics.filter(c => c !== char)
      : [...selectedCharacteristics, char];
    setSelectedCharacteristics(newChars);
    setFormData({ ...formData, characteristics: newChars });
  };

  const generateSample = async () => {
    if (!formData.name) {
      toast.error('Enter persona name first');
      return;
    }

    setGenerating(true);
    try {
      const prompt = `A ${formData.age} ${formData.voice_type} voice with a ${formData.accent} accent that sounds ${selectedCharacteristics.join(', ')}. Say: "Hello, I'm ${formData.name}. This is my voice for AI music creation."`;

      const res = await base44.functions.invoke('synthesizeVoice', {
        text: prompt,
        persona_name: formData.name,
        voice_type: formData.voice_type,
        accent: formData.accent,
        characteristics: selectedCharacteristics,
        provider: formData.provider,
      });
      const result = res.data || res;
      if (!result.audio_url) throw new Error(result.error || 'Synthesis failed');

      setAudioUrl(result.audio_url);
      setFormData({ ...formData, sample_url: result.audio_url, provider_voice_id: result.voice_id });
      toast.success('Voice sample generated!');
    } catch (error) {
      toast.error(error.message);
    }
    setGenerating(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name) {
      toast.error('Enter a persona name');
      return;
    }

    try {
      await onSave({
        ...formData,
        sample_url: audioUrl
      });
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-8 space-y-6">
      <h3 className="text-2xl font-black text-foreground mb-6">
        {persona ? 'Edit Persona' : 'Create Persona'}
      </h3>

      {/* Basic Info */}
      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">Persona Name *</label>
          <Input
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            placeholder="e.g., Jazz Singer, Rap MC"
            className="rounded-xl"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">Description</label>
          <Textarea
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="Describe this voice persona..."
            rows={3}
            className="rounded-xl"
          />
        </div>
      </div>

      {/* Voice Characteristics */}
      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">Voice Type</label>
          <Select value={formData.voice_type} onValueChange={(v) => handleInputChange('voice_type', v)}>
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VOICE_TYPES.map((type) => (
                <SelectItem key={type} value={type} className="capitalize">
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">Age</label>
            <Select value={formData.age} onValueChange={(v) => handleInputChange('age', v)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGES.map((age) => (
                  <SelectItem key={age} value={age} className="capitalize">
                    {age}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">Accent</label>
            <Select value={formData.accent} onValueChange={(v) => handleInputChange('accent', v)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCENTS.map((accent) => (
                  <SelectItem key={accent} value={accent} className="capitalize">
                    {accent}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">Voice Characteristics</label>
          <div className="grid grid-cols-3 gap-2">
            {CHARACTERISTICS.map((char) => (
              <button
                key={char}
                type="button"
                onClick={() => toggleCharacteristic(char)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  selectedCharacteristics.includes(char)
                    ? 'bg-pink-600 text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {char}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Voice Provider */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">Voice Provider</label>
        <Select value={formData.provider} onValueChange={(v) => handleInputChange('provider', v)}>
          <SelectTrigger className="rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
            <SelectItem value="inworld">Inworld (TTS-2 character voices)</SelectItem>
            <SelectItem value="google">Google Cloud TTS</SelectItem>
            <SelectItem value="azure">Azure Speech</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Voice Sample */}
      <div className="bg-muted/20 rounded-xl border border-border p-4 space-y-3">
        <h4 className="text-sm font-bold text-foreground">Voice Sample</h4>
        
        {audioUrl && (
          <div className="bg-background rounded-lg p-3 space-y-2">
            <audio ref={audioRef} controls className="w-full rounded-lg" src={audioUrl} />
          </div>
        )}

        <Button
          type="button"
          onClick={generateSample}
          disabled={generating}
          className="w-full bg-purple-600 hover:bg-purple-500 rounded-xl gap-2"
        >
          {generating ? (
            <><Loader className="w-4 h-4 animate-spin" /> Generating…</>
          ) : (
            <><Play className="w-4 h-4" /> Generate Sample Voice</>
          )}
        </Button>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-6 border-t border-border">
        <Button type="button" onClick={onCancel} variant="outline" className="flex-1 rounded-xl">
          Cancel
        </Button>
        <Button type="submit" className="flex-1 bg-pink-600 hover:bg-pink-500 rounded-xl font-bold">
          Save Persona
        </Button>
      </div>
    </form>
  );
}