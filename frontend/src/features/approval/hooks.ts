import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveReview,
  articleHistory,
  cancelReview,
  getReviewRequest,
  listArticleReviews,
  rejectReview,
  reviewInbox,
  submitReview,
  type InboxParams,
} from './api';

export const reviewKeys = {
  inbox: (p: InboxParams) => ['review-requests', 'inbox', p] as const,
  detail: (id: string) => ['review-requests', id] as const,
  articleReviews: (kbId: string, articleId: string) => ['kbs', kbId, 'articles', articleId, 'reviews'] as const,
  articleHistory: (kbId: string, articleId: string) => ['kbs', kbId, 'articles', articleId, 'history'] as const,
};

export function useReviewInbox(p: InboxParams = {}) {
  return useQuery({ queryKey: reviewKeys.inbox(p), queryFn: () => reviewInbox(p) });
}

export function useReviewRequest(id: string) {
  return useQuery({ queryKey: reviewKeys.detail(id), queryFn: () => getReviewRequest(id) });
}

export function useArticleReviews(kbId: string, articleId: string) {
  return useQuery({ queryKey: reviewKeys.articleReviews(kbId, articleId), queryFn: () => listArticleReviews(kbId, articleId) });
}

export function useArticleHistory(kbId: string, articleId: string) {
  return useQuery({ queryKey: reviewKeys.articleHistory(kbId, articleId), queryFn: () => articleHistory(kbId, articleId) });
}

function useInvalidateReview(kbId?: string, articleId?: string) {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: ['review-requests'] });
    if (kbId && articleId) {
      void client.invalidateQueries({ queryKey: reviewKeys.articleReviews(kbId, articleId) });
      void client.invalidateQueries({ queryKey: reviewKeys.articleHistory(kbId, articleId) });
      void client.invalidateQueries({ queryKey: ['kbs', kbId, 'articles', articleId] });
      void client.invalidateQueries({ queryKey: ['kbs', kbId, 'articles'] });
    }
  };
}

export function useSubmitReview(kbId: string, articleId: string) {
  const invalidate = useInvalidateReview(kbId, articleId);
  return useMutation({
    mutationFn: (input: { reviewerId: string; comment?: string }) => submitReview(kbId, articleId, input),
    onSuccess: invalidate,
  });
}

export function useApproveReview(kbId?: string, articleId?: string) {
  const invalidate = useInvalidateReview(kbId, articleId);
  return useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) => approveReview(id, { comment }),
    onSuccess: invalidate,
  });
}

export function useRejectReview(kbId?: string, articleId?: string) {
  const invalidate = useInvalidateReview(kbId, articleId);
  return useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) => rejectReview(id, { comment }),
    onSuccess: invalidate,
  });
}

export function useCancelReview(kbId?: string, articleId?: string) {
  const invalidate = useInvalidateReview(kbId, articleId);
  return useMutation({
    mutationFn: (id: string) => cancelReview(id),
    onSuccess: invalidate,
  });
}
