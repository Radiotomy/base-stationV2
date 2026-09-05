import { Link } from 'react-router-dom';
import { ImageOff } from 'lucide-react';

/**
 * Shown instead of a publish toggle when a track has no cover art. Audius rejects
 * artwork-less uploads at its content node, so the row is stopped here rather than
 * failing after the audio has already been streamed.
 */
export default function MissingArtworkHint() {
  return (
    <Link
      to="/cover-art-studio"
      className="flex items-center gap-1 text-[11px] font-semibold text-amber-300 hover:text-amber-200 whitespace-nowrap"
      title="Audius requires cover art on every release"
    >
      <ImageOff className="w-3 h-3" /> Add artwork
    </Link>
  );
}