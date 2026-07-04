import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic2, Plus, Edit2, Trash2, Play, Star, ArrowLeft, Loader, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import VoicePersonaForm from '@/components/voice/VoicePersonaForm';
import SonicVoiceCloner from '@/components/voice/SonicVoiceCloner';
import VoicePersonaCard from '@/components/voice/VoicePersonaCard';
import VoiceSynthesisPanel from '@/components/voice/VoiceSynthesisPanel';
import InfoTip from '@/components/common/InfoTip';

export default function VoiceCreator() {
  const [user, setUser] = useState(null);
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showCloner, setShowCloner] = useState(false);
  const [editingPersona, setEditingPersona] = useState(null);
  const [selectedPersona, setSelectedPersona] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      base44.entities.VoicePersona.filter({ user_id: u.id }, '-created_date', 50).then(p => {
        setPersonas(p);
        setLoading(false);
      });
    });
  }, []);

  const handleSavePersona = async (data) => {
    try {
      if (editingPersona) {
        await base44.entities.VoicePersona.update(editingPersona.id, data);
        setPersonas(personas.map(p => p.id === editingPersona.id ? { ...p, ...data } : p));
        toast.success('Persona updated!');
      } else {
        const newPersona = await base44.entities.VoicePersona.create({ ...data, user_id: user.id, user_email: user.email });
        setPersonas([newPersona, ...personas]);
        toast.success('Persona created!');
      }
      setShowForm(false);
      setEditingPersona(null);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDeletePersona = async (id) => {
    if (window.confirm('Delete this persona?')) {
      try {
        await base44.entities.VoicePersona.delete(id);
        setPersonas(personas.filter(p => p.id !== id));
        toast.success('Persona deleted');
      } catch (error) {
        toast.error(error.message);
      }
    }
  };

  const handleToggleFavorite = async (persona) => {
    try {
      await base44.entities.VoicePersona.update(persona.id, { is_favorite: !persona.is_favorite });
      setPersonas(personas.map(p => p.id === persona.id ? { ...p, is_favorite: !p.is_favorite } : p));
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

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
      <div className="relative overflow-hidden pt-20 pb-12 px-6 bg-gradient-to-br from-pink-900/30 to-black">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-5xl font-black text-white mb-3 tracking-tight">🎤 Voice Creator</h1>
          <p className="text-white/60 text-lg">Create, manage, and use AI voice personas for your tracks.</p>
        </div>
      </div>

      {/* Main */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Create Button */}
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-2xl font-black text-foreground flex items-center gap-2">
            Your Voice Personas
            <InfoTip size="sm" text="Build a persona once (voice type, age, characteristics) and reuse it across every Music Studio generation for a consistent artist identity." />
          </h2>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowCloner(true)}
              className="bg-cyan-600 hover:bg-cyan-500 rounded-xl gap-2 font-bold"
            >
              <Mic2 className="w-4 h-4" /> Clone Voice
            </Button>
            <Button
              onClick={() => {
                setEditingPersona(null);
                setShowForm(true);
              }}
              className="bg-pink-600 hover:bg-pink-500 rounded-xl gap-2 font-bold"
            >
              <Plus className="w-4 h-4" /> Create Persona
            </Button>
          </div>
        </div>

        {/* Form Modal */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              onClick={() => {
                setShowForm(false);
                setEditingPersona(null);
              }}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-card rounded-2xl border border-border max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              >
                <VoicePersonaForm
                  persona={editingPersona}
                  onSave={handleSavePersona}
                  onCancel={() => {
                    setShowForm(false);
                    setEditingPersona(null);
                  }}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Voice Cloner Modal */}
        <AnimatePresence>
          {showCloner && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              onClick={() => setShowCloner(false)}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-card rounded-2xl border border-border max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              >
                <SonicVoiceCloner
                  onCreated={(persona) => {
                    setPersonas([persona, ...personas]);
                    setShowCloner(false);
                  }}
                  onCancel={() => setShowCloner(false)}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Personas Grid */}
        {personas.length === 0 ? (
          <div className="text-center py-20">
            <Mic2 className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-30" />
            <p className="text-muted-foreground mb-4">No voice personas yet</p>
            <Button
              onClick={() => setShowForm(true)}
              className="bg-pink-600 hover:bg-pink-500 rounded-xl gap-2"
            >
              <Plus className="w-4 h-4" /> Create Your First Persona
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {personas.map((persona, i) => (
              <motion.div
                key={persona.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <VoicePersonaCard
                  persona={persona}
                  onEdit={() => {
                    setEditingPersona(persona);
                    setShowForm(true);
                  }}
                  onDelete={() => handleDeletePersona(persona.id)}
                  onToggleFavorite={() => handleToggleFavorite(persona)}
                  onSelect={() => setSelectedPersona(persona)}
                />
              </motion.div>
            ))}
          </div>
        )}

        {/* Selected Persona Preview */}
        {selectedPersona && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-12 space-y-6"
          >
            <div className="bg-card rounded-2xl border border-border p-6">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-2xl font-black text-foreground">{selectedPersona.name}</h3>
                <Button onClick={() => setSelectedPersona(null)} variant="ghost" size="sm" className="rounded-xl">✕</Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  {selectedPersona.description && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Description</p>
                      <p className="text-foreground text-sm">{selectedPersona.description}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Voice Type</p>
                      <Badge className="capitalize bg-pink-500/20 text-pink-300 border-0">{selectedPersona.voice_type}</Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Age</p>
                      <Badge className="capitalize bg-blue-500/20 text-blue-300 border-0">{selectedPersona.age}</Badge>
                    </div>
                  </div>
                  {selectedPersona.characteristics?.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold mb-2">Characteristics</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedPersona.characteristics.map((c, i) => (
                          <Badge key={i} variant="outline" className="capitalize text-xs">{c}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {selectedPersona.sample_url && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold mb-2">Voice Sample</p>
                    <audio controls className="w-full rounded-xl" src={selectedPersona.sample_url} />
                  </div>
                )}
              </div>
            </div>

            {/* Live Synthesis Test */}
            <VoiceSynthesisPanel persona={selectedPersona} />
          </motion.div>
        )}
      </div>
    </div>
  );
}