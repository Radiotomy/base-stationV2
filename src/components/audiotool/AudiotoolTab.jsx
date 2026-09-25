import useAudiotool from '@/hooks/useAudiotool';
import AudiotoolConnectCard from '@/components/audiotool/AudiotoolConnectCard';
import AudiotoolProjectPanel from '@/components/audiotool/AudiotoolProjectPanel';

export default function AudiotoolTab() {
  const audiotool = useAudiotool();
  return (
    <div className="space-y-6">
      <AudiotoolConnectCard {...audiotool} />
      {audiotool.status === 'authenticated' && <AudiotoolProjectPanel at={audiotool.at} />}
    </div>
  );
}