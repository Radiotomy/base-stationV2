import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const FIVE_MIN = 5 * 60 * 1000;

// Shared, cached entity lists for the Home page stat panels.
// One fetch per entity per 5 minutes — shared across every component
// that uses the same entity, instead of each panel re-downloading
// thousands of records on its own timer.
export function useEntityList(entityName) {
  return useQuery({
    queryKey: ['home-list', entityName],
    queryFn: () => base44.entities[entityName].list('-created_date', 1000),
    staleTime: FIVE_MIN,
    gcTime: FIVE_MIN,
    refetchOnWindowFocus: false,
  });
}