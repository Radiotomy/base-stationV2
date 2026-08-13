import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import TimelineLibraryPicker from './TimelineLibraryPicker';

/**
 * Modal wrapper around the library picker, used anywhere a studio needs one
 * asset of a given kind ('video' | 'audio' | 'image').
 * onPick(kind, url, title)
 */
export default function LibraryAssetModal({ open, onClose, only = null, title = 'Pick from your library', onPick }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <TimelineLibraryPicker
          only={only}
          onPick={(kind, url, label) => { onPick(kind, url, label); onClose(); }}
        />
      </DialogContent>
    </Dialog>
  );
}