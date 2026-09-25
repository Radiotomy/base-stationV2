import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Send, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBridgeSession } from './BridgeSessionContext';
import { loadAsWavFile } from '@/lib/audiotool/localAudio';
import { sendToAudiotool } from '@/lib/audiotool/sendToAudiotool';

/** Pass `getFile` when a local WAV is already loaded; otherwise `url` is fetched and converted. */
export default function SendToAudiotoolButton({ url, getFile, name, bpm, aiTool, prompt, className = '' }) {
  const session = useBridgeSession();
  const [state, setState] = useState('idle');
  if (!session?.nexus) return null;

  const send = async () => {
    setState('sending');
    try {
      const file = getFile ? await getFile() : await loadAsWavFile(url, name);
      const { bar } = await sendToAudiotool({ ...session, file, name, bpm, aiTool, prompt });
      toast.success(`"${name}" placed on your Audiotool timeline at bar ${bar}.`);
      setState('sent');
      session.onChanged?.();
    } catch (e) {
      toast.error(`Couldn't send to Audiotool: ${e.message}`);
      setState('idle');
    }
  };

  return (
    <Button size="sm" className={`merc-button ${className}`} onClick={send} disabled={state === 'sending' || (!url && !getFile)}>
      {state === 'sending' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : state === 'sent' ? <Check className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
      {state === 'sending' ? 'Uploading to Audiotool…' : state === 'sent' ? 'Sent — send again' : 'Send to Audiotool'}
    </Button>
  );
}