import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { FileMusic } from 'lucide-react';
import AssetPicker from '@/components/studio/AssetPicker';

/** Pick any generated or uploaded track and open it for extraction. */
export default function ScoreExtractSection({ onOpen }) {
  const [selected, setSelected] = useState([]);
  const [opening, setOpening] = useState(false);

  const open = async () => {
    setOpening(true);
    const a = await base44.entities.UserAsset.get(selected[0]);
    setOpening(false);
    onOpen(a);
  };

  return (
    <section className="merc-card rounded-2xl p-6 space-y-4">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2"><FileMusic className="w-5 h-5" /> Extract a new score</h2>
        <p className="text-sm text-muted-foreground">
          Turn any generated or uploaded track into a lead sheet (melody, chords, key and sections) plus a MIDI file.
          Free, and yours to use commercially.
        </p>
      </div>
      <AssetPicker selected={selected} onChange={setSelected} />
      <Button disabled={!selected.length || opening} onClick={open} className="merc-button">
        <FileMusic className="w-4 h-4 mr-2" /> Extract MIDI & Score
      </Button>
    </section>
  );
}