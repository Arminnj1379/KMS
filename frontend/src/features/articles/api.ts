import { apiClient } from '../../shared/lib/api-client';

export interface ArticleAttachment {
  documentId: string;
  createdBy: string;
  createdAt: string;
}

export interface Article {
  id: string;
  knowledgeBaseId: string;
  categoryId: string | null;
  authorId: string;
  title: string;
  slug: string;
  summary: string | null;
  contentJson: Record<string, unknown>;
  contentText: string;
  status: string;
  version: number;
  viewCount: number;
  tagIds: string[];
  tagNames: string[];
  attachments: ArticleAttachment[];
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ArticleList {
  items: Article[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ArticleListParams {
  status?: string;
  categoryId?: string;
  includeSubtree?: boolean;
  tag?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sort?: 'newest' | 'updated' | 'title';
}

export interface KbTag {
  id: string;
  name: string;
  slug: string;
  articleCount: number;
}

function params(p: ArticleListParams): Record<string, unknown> {
  return {
    ...(p.status ? { status: p.status } : {}),
    ...(p.categoryId ? { categoryId: p.categoryId } : {}),
    ...(p.includeSubtree ? { includeSubtree: true } : {}),
    ...(p.tag ? { tag: p.tag } : {}),
    ...(p.search ? { search: p.search } : {}),
    ...(p.page ? { page: p.page } : {}),
    ...(p.pageSize ? { pageSize: p.pageSize } : {}),
    ...(p.sort ? { sort: p.sort } : {}),
  };
}

export async function listArticles(kbId: string, p: ArticleListParams = {}): Promise<ArticleList> {
  const { data } = await apiClient.get<ArticleList>(`/knowledge-bases/${kbId}/articles`, { params: params(p) });
  return data;
}

export async function getArticle(kbId: string, articleId: string): Promise<Article> {
  const { data } = await apiClient.get<Article>(`/knowledge-bases/${kbId}/articles/${articleId}`);
  return data;
}

export async function createArticle(
  kbId: string,
  input: {
    title: string;
    slug: string;
    summary?: string;
    contentJson: Record<string, unknown>;
    contentText?: string;
    categoryId?: string;
    tagNames?: string[];
  },
): Promise<Article> {
  const { data } = await apiClient.post<Article>(`/knowledge-bases/${kbId}/articles`, input);
  return data;
}

export async function updateArticle(
  kbId: string,
  articleId: string,
  input: {
    version: number;
    title?: string;
    summary?: string | null;
    contentJson?: Record<string, unknown>;
    contentText?: string;
    categoryId?: string | null;
    tagNames?: string[];
    changelog?: string;
  },
): Promise<Article> {
  const { data } = await apiClient.patch<Article>(`/knowledge-bases/${kbId}/articles/${articleId}`, input);
  return data;
}

export async function deleteArticle(kbId: string, articleId: string): Promise<void> {
  await apiClient.delete(`/knowledge-bases/${kbId}/articles/${articleId}`);
}

export async function publishArticle(kbId: string, articleId: string): Promise<Article> {
  const { data } = await apiClient.post<Article>(`/knowledge-bases/${kbId}/articles/${articleId}/publish`);
  return data;
}

export async function unpublishArticle(kbId: string, articleId: string): Promise<Article> {
  const { data } = await apiClient.post<Article>(`/knowledge-bases/${kbId}/articles/${articleId}/unpublish`);
  return data;
}

export async function archiveArticle(kbId: string, articleId: string): Promise<Article> {
  const { data } = await apiClient.post<Article>(`/knowledge-bases/${kbId}/articles/${articleId}/archive`);
  return data;
}

export async function restoreArticle(kbId: string, articleId: string): Promise<Article> {
  const { data } = await apiClient.post<Article>(`/knowledge-bases/${kbId}/articles/${articleId}/restore`);
  return data;
}

export async function relatedArticles(kbId: string, articleId: string): Promise<Article[]> {
  const { data } = await apiClient.get<Article[]>(`/knowledge-bases/${kbId}/articles/${articleId}/related`);
  return data;
}

export async function listKbTags(kbId: string): Promise<KbTag[]> {
  const { data } = await apiClient.get<KbTag[]>(`/knowledge-bases/${kbId}/articles/tags`);
  return data;
}
