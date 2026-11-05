import { useQuery } from '@tanstack/react-query';
import { searchArticles, type SearchParams } from './api';

export const searchKeys = {
  result: (p: SearchParams) => ['search', p] as const,
};

export function useSearch(p: SearchParams) {
  const q = p.q.trim();
  return useQuery({
    queryKey: searchKeys.result({ ...p, q }),
    queryFn: () => searchArticles({ ...p, q }),
    enabled: q.length >= 2,
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });
}
