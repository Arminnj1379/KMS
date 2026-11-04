import { apiClient } from '../../shared/lib/api-client';

export interface ReviewRequest {
  id: string;
  organizationId: string;
  knowledgeBaseId: string;
  articleId: string;
  articleTitle: string;
  articleSlug: string;
  kbTitle: string;
  kbSlug: string;
  requesterId: string;
  reviewerId: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  comment: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface WorkflowHistoryEntry {
  id: string;
  articleId: string;
  fromStatus: string;
  toStatus: string;
  actorId: string;
  comment: string | null;
  createdAt: string;
}

export interface InboxList {
  items: ReviewRequest[];
  total: number;
  page: number;
  pageSize: number;
}

export interface InboxParams {
  role?: 'reviewer' | 'requester';
  status?: string;
  page?: number;
  pageSize?: number;
}

function params(p: InboxParams): Record<string, unknown> {
  return {
    ...(p.role ? { role: p.role } : {}),
    ...(p.status ? { status: p.status } : {}),
    ...(p.page ? { page: p.page } : {}),
    ...(p.pageSize ? { pageSize: p.pageSize } : {}),
  };
}

export async function submitReview(
  kbId: string,
  articleId: string,
  input: { reviewerId: string; comment?: string },
): Promise<{ article: unknown; reviewRequest: ReviewRequest }> {
  const { data } = await apiClient.post(`/knowledge-bases/${kbId}/articles/${articleId}/submit`, input);
  return data;
}

export async function listArticleReviews(kbId: string, articleId: string): Promise<ReviewRequest[]> {
  const { data } = await apiClient.get<ReviewRequest[]>(`/knowledge-bases/${kbId}/articles/${articleId}/review-requests`);
  return data;
}

export async function articleHistory(kbId: string, articleId: string): Promise<WorkflowHistoryEntry[]> {
  const { data } = await apiClient.get<WorkflowHistoryEntry[]>(
    `/knowledge-bases/${kbId}/articles/${articleId}/history`,
  );
  return data;
}

export async function reviewInbox(p: InboxParams = {}): Promise<InboxList> {
  const { data } = await apiClient.get<InboxList>('/review-requests', { params: params(p) });
  return data;
}

export async function getReviewRequest(id: string): Promise<ReviewRequest> {
  const { data } = await apiClient.get<ReviewRequest>(`/review-requests/${id}`);
  return data;
}

export async function approveReview(
  id: string,
  input: { comment?: string },
): Promise<{ article: unknown; reviewRequest: ReviewRequest }> {
  const { data } = await apiClient.post(`/review-requests/${id}/approve`, input);
  return data;
}

export async function rejectReview(
  id: string,
  input: { comment?: string },
): Promise<{ article: unknown; reviewRequest: ReviewRequest }> {
  const { data } = await apiClient.post(`/review-requests/${id}/reject`, input);
  return data;
}

export async function cancelReview(id: string): Promise<{ article: unknown; reviewRequest: ReviewRequest }> {
  const { data } = await apiClient.post(`/review-requests/${id}/cancel`, {});
  return data;
}
