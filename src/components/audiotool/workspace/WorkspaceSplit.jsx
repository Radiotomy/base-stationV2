import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import AudiotoolEmbedPane from './AudiotoolEmbedPane';

/** BASE Station tools on the left, the live Audiotool studio on the right. */
export default function WorkspaceSplit({ session, split, onResize, onClose, children }) {
  return (
    <ResizablePanelGroup direction="horizontal" className="!h-[calc(100vh-4.5rem)]">
      <ResizablePanel defaultSize={100 - split.size} minSize={25}>
        <div className="h-full overflow-y-auto px-4 sm:px-6 py-6">{children}</div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={split.size} minSize={25} onResize={onResize}>
        <AudiotoolEmbedPane session={session} onClose={onClose} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}