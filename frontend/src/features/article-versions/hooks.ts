import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { diffVersions, getVersion, listVersions, restoreVersion, snapshotCurrent } from './api';

export const versionKeys = {
  list: (kbId: string, articleId: string) => ['kbs', kbId, 'articles', articleId, 'versions'] as const,
  detail: (kbId: string, articleId: string, version: number) =>
    ['kbs', kbId, 'articles', articleId, 'versions', version] as const,
  diff: (kbId: string, articleId: string, from: number, to: number) =>
    ['kbs', kbId, 'articles', articleId, 'versions', from, 'diff', to] as const,
};

export function useVersions(kbId: string, articleId: string) {
  return useQuery({ queryKey: versionKeys.list(kbId, articleId), queryFn: () => listVersions(kbId, articleId) });
}

export function useVersionDetail(kbId: string, articleId: string, version: number | null) {
  return useQuery({
    queryKey: versionKeys.detail(kbId, articleId, version ?? 0),
    queryFn: () => getVersion(kbId, articleId, version ?? 0),
    enabled: version !== null,
  });
}

export function useVersionDiff(kbId: string, articleId: string, from: number | null, to: number | null) {
  return useQuery({
    queryKey: versionKeys.diff(kbId, articleId, from ?? 0, to ?? 0),
    queryFn: () => diffVersions(kbId, articleId, from ?? 0, to ?? 0),
    enabled: from !== null && to !== null && from !== to,
  });
}

export function useSnapshotVersion(kbId: string, articleId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (changelog?: string) => snapshotCurrent(kbId, articleId, changelog),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: versionKeys.list(kbId, articleId) });
    },
  });
}

export function useRestoreVersion(kbId: string, articleId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ version, changelog }: { version: number; changelog?: string }) =>
      restoreVersion(kbId, articleId, version, changelog),
    onSuccess: (data) => {
      client.setQueryData(['kbs', kbId, 'articles', articleId], data);
      void client.invalidateQueries({ queryKey: ['kbs', kbId, 'articles'] });
      void client.invalidateQueries({ queryKey: versionKeys.list(kbId, articleId) });
    },
  });
}
