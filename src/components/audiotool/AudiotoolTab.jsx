import useAudiotool from '@/hooks/useAudiotool';
import AudiotoolConnectCard from '@/components/audiotool/AudiotoolConnectCard';
import AudiotoolAccountCard from '@/components/audiotool/AudiotoolAccountCard';
import AudiotoolProjectPanel from '@/components/audiotool/AudiotoolProjectPanel';

export default function AudiotoolTab() {
  const audiotool = useAudiotool();
  const signedIn = audiotool.status === 'authenticated';
  return (
    <div className="space-y-6">
      {signedIn ? <AudiotoolAccountCard {...audiotool} /> : <AudiotoolConnectCard {...audiotool} />}
      {signedIn && <AudiotoolProjectPanel at={audiotool.at} />}
    </div>
  );
}