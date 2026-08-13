import { useState } from 'react';
import { Library, UploadCloud, Link2 } from 'lucide-react';
import TimelineLibraryPicker from './TimelineLibraryPicker';
import TimelineUploadDrop from './TimelineUploadDrop';
import AddClipBar from './AddClipBar';

const TABS = [
  { id: 'library', label: 'My Library', icon: Library },
  { id: 'upload', label: 'Upload', icon: UploadCloud },
  { id: 'url', label: 'URL / Text', icon: Link2 },
];

/**
 * One place to pull timeline material from every source: the user's asset
 * library, a local file upload, or an external URL / text title.
 * onAdd(kind, src, label?) — kind is 'video' | 'audio' | 'image' | 'title'.
 */
export default function TimelineAssetPanel({ onAdd, disabled }) {
  const [tab, setTab] = useState('library');

  return (
    <div className="p-4 rounded-xl bg-card border border-border space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase">Add to timeline</p>
      <div className="flex gap-1.5 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-all ${tab === t.id ? 'bg-indigo-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'library' && <TimelineLibraryPicker onPick={onAdd} disabled={disabled} />}
      {tab === 'upload' && <TimelineUploadDrop onUploaded={onAdd} disabled={disabled} />}
      {tab === 'url' && <AddClipBar onAdd={onAdd} disabled={disabled} />}
    </div>
  );
}