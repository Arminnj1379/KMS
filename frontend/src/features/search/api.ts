import { apiClient } from '../../shared/lib/api-client';
import type { Article } from '../articles/api';

export interface SearchHit extends Article {
  kbTitle: string;
  kbSlug: string;
  snippet: string;
}

export interface SearchResult {
  items: SearchHit[];
  total: number;
  page: number;
  pageSize: number;
  mode: 'text' | 'regex';
}

export interface SearchParams {
  q: string;
  status?: string;
  kbId?: string;
  tag?: string;
  page?: number;
  pageSize?: number;
  sort?: 'relevance' | 'newest' | 'updated';
}

function params(p: SearchParams): Record<string, unknown> {
  return {
    q: p.q,
    ...(p.status ? { status: p.status } : {}),
    ...(p.kbId ? { kbId: p.kbId } : {}),
    ...(p.tag ? { tag: p.tag } : {}),
    ...(p.page ? { page: p.page } : {}),
    ...(p.pageSize ? { pageSize: p.pageSize } : {}),
    ...(p.sort ? { sort: p.sort } : {}),
  };
}

export async function searchArticles(p: SearchParams): Promise<SearchResult> {
  const { data } = await apiClient.get<SearchResult>('/search', { params: params(p) });
  return data;
}
