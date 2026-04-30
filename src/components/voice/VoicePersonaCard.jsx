import { motion } from 'framer-motion';
import { Edit2, Trash2, Star, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function VoicePersonaCard({ persona, onEdit, onDelete, onToggleFavorite, onSelect }) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="bg-card rounded-2xl border border-border overflow-hidden hover:border-pink-500/30 transition-all cursor-pointer group"
      onClick={onSelect}
    >
      {/* Header with Favorite */}
      <div className="p-4 bg-gradient-to-r from-pink-900/20 to-purple-900/20 flex items-start justify-between">
        <div>
          <h3 className="font-bold text-foreground text-lg">{persona.name}</h3>
          <p className="text-xs text-muted-foreground capitalize">{persona.voice_type} • {persona.age} • {persona.accent}</p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className={`transition-transform ${persona.is_favorite ? 'text-yellow-400 scale-110' : 'text-muted-foreground'}`}
        >
          <Star className="w-5 h-5" fill={persona.is_favorite ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Description */}
        {persona.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{persona.description}</p>
        )}

        {/* Characteristics */}
        {persona.characteristics?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {persona.characteristics.slice(0, 3).map((char) => (
              <Badge key={char} variant="outline" className="text-xs capitalize">
                {char}
              </Badge>
            ))}
            {persona.characteristics.length > 3 && (
              <Badge variant="outline" className="text-xs">+{persona.characteristics.length - 3}</Badge>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
          <span>{persona.usage_count} tracks</span>
          <span className="capitalize text-pink-400">{persona.provider}</span>
        </div>

        {/* Sample Preview */}
        {persona.sample_url && (
          <div className="flex items-center gap-2 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <audio controls className="flex-1 h-6 rounded" src={persona.sample_url} onClick={(e) => e.stopPropagation()} />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-3 border-t border-border flex gap-2 bg-muted/20 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="flex-1 rounded-lg gap-1 h-7 text-xs"
        >
          <Edit2 className="w-3 h-3" /> Edit
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="flex-1 rounded-lg gap-1 h-7 text-xs text-destructive hover:text-destructive"
        >
          <Trash2 className="w-3 h-3" /> Delete
        </Button>
      </div>
    </motion.div>
  );
}