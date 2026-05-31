import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import AssetPicker from '@/components/studio/AssetPicker';
import { Music } from 'lucide-react';

/**
 * Modal that lets the user pick an audio track from their library
 * (UserAsset where asset_type='track') and hand the file_url back to
 * the composer.
 */
export default function LibraryTrackPickerModal({ open, onClose, onSelect }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    const id = selectedIds[0];
    if (!id) return;
    setConfirming(true);
    try {
      const asset = await base44.entities.UserAsset.get(id);
      onSelect({
        file_url: asset.file_url,
        title: asset.title,
        metadata: asset.metadata || {},
      });
      onClose();
      setSelectedIds([]);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="w-4 h-4" /> Pick a Track from Your Library
          </DialogTitle>
        </DialogHeader>

        <AssetPicker
          assetType="track"
          multi={false}
          selected={selectedIds}
          onChange={setSelectedIds}
        />

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedIds.length === 0 || confirming}
            className="bg-indigo-600 hover:bg-indigo-500 gap-2"
          >
            {confirming ? 'Loading…' : 'Use this Track'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}