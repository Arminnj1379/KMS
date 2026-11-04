import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  archiveArticle,
  createArticle,
  deleteArticle,
  getArticle,
  listArticles,
  listKbTags,
  publishArticle,
  relatedArticles,
  restoreArticle,
  unpublishArticle,
  updateArticle,
  type ArticleListParams,
} from './api';

export const articleKeys = {
  list: (kbId: string, p: ArticleListParams) => ['kbs', kbId, 'articles', p] as const,
  detail: (kbId: string, articleId: string) => ['kbs', kbId, 'articles', articleId] as const,
  related: (kbId: string, articleId: string) => ['kbs', kbId, 'articles', articleId, 'related'] as const,
  tags: (kbId: string) => ['kbs', kbId, 'articles-tags'] as const,
};

export function useArticles(kbId: string, p: ArticleListParams = {}) {
  return useQuery({
    queryKey: articleKeys.list(kbId, p),
    queryFn: () => listArticles(kbId, p),
  });
}

export function useArticle(kbId: string, articleId: string) {
  return useQuery({ queryKey: articleKeys.detail(kbId, articleId), queryFn: () => getArticle(kbId, articleId) });
}

export function useRelatedArticles(kbId: string, articleId: string) {
  return useQuery({
    queryKey: articleKeys.related(kbId, articleId),
    queryFn: () => relatedArticles(kbId, articleId),
  });
}

export function useKbTags(kbId: string) {
  return useQuery({ queryKey: articleKeys.tags(kbId), queryFn: () => listKbTags(kbId) });
}

function useInvalidateKbArticles(kbId: string) {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: ['kbs', kbId, 'articles'] });
    void client.invalidateQueries({ queryKey: ['kbs', kbId, 'articles-tags'] });
  };
}

export function useCreateArticle(kbId: string) {
  const invalidate = useInvalidateKbArticles(kbId);
  return useMutation({
    mutationFn: (input: Parameters<typeof createArticle>[1]) => createArticle(kbId, input),
    onSuccess: invalidate,
  });
}

export function useUpdateArticle(kbId: string, articleId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof updateArticle>[2]) => updateArticle(kbId, articleId, input),
    onSuccess: (data) => {
      client.setQueryData(articleKeys.detail(kbId, articleId), data);
      void client.invalidateQueries({ queryKey: ['kbs', kbId, 'articles'] });
      void client.invalidateQueries({ queryKey: articleKeys.tags(kbId) });
    },
  });
}

function useTransition(kbId: string, articleId: string, fn: (kb: string, id: string) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => fn(kbId, articleId),
    onSuccess: (data) => {
      client.setQueryData(articleKeys.detail(kbId, articleId), data);
      void client.invalidateQueries({ queryKey: ['kbs', kbId, 'articles'] });
    },
  });
}

export function usePublishArticle(kbId: string, articleId: string) {
  return useTransition(kbId, articleId, publishArticle);
}

export function useUnpublishArticle(kbId: string, articleId: string) {
  return useTransition(kbId, articleId, unpublishArticle);
}

export function useArchiveArticle(kbId: string, articleId: string) {
  return useTransition(kbId, articleId, archiveArticle);
}

export function useRestoreArticle(kbId: string, articleId: string) {
  return useTransition(kbId, articleId, restoreArticle);
}

export function useDeleteArticle(kbId: string) {
  const invalidate = useInvalidateKbArticles(kbId);
  return useMutation({
    mutationFn: (articleId: string) => deleteArticle(kbId, articleId),
    onSuccess: invalidate,
  });
}
