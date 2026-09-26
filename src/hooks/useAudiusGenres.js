import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/** Audius genre list + the genre the project tags suggest, both from the server. */
export default function useAudiusGenres(tags = []) {
  const key = tags.join('|');
  const { data } = useQuery({
    queryKey: ['audiusGenres', key],
    queryFn: async () => (await base44.functions.invoke('audiusGenres', { tags })).data,
    staleTime: Infinity,
  });
  return { genres: data?.genres || [], suggested: data?.suggested || '' };
}