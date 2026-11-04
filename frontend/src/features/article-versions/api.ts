import { apiClient } from '../../shared/lib/api-client';

export interface ArticleVersionItem {
  id: string;
  articleId: string;
  version: number;
  title: string;
  summary: string | null;
  changelog: string | null;
  createdBy: string;
  createdAt: string;
}

export interface ArticleVersionDetail extends ArticleVersionItem {
  contentJson: Record<string, unknown>;
  contentText: string;
}

export interface DiffHunk {
  type: 'same' | 'del' | 'add';
  lines: string[];
}

export interface VersionDiff {
  from: { version: number; title: string; changelog: string | null; createdAt: string };
  to: { version: number; title: string; changelog: string | null; createdAt: string };
  titleChanged: boolean;
  summaryChanged: boolean;
  hunks: DiffHunk[];
}

export async function listVersions(kbId: string, articleId: string): Promise<ArticleVersionItem[]> {
  const { data } = await apiClient.get<ArticleVersionItem[]>(
    `/knowledge-bases/${kbId}/articles/${articleId}/versions`,
  );
  return data;
}

export async function getVersion(kbId: string, articleId: string, version: number): Promise<ArticleVersionDetail> {
  const { data } = await apiClient.get<ArticleVersionDetail>(
    `/knowledge-bases/${kbId}/articles/${articleId}/versions/${version}`,
  );
  return data;
}

export async function snapshotCurrent(
  kbId: string,
  articleId: string,
  changelog?: string,
): Promise<ArticleVersionDetail> {
  const { data } = await apiClient.post<ArticleVersionDetail>(
    `/knowledge-bases/${kbId}/articles/${articleId}/versions`,
    changelog ? { changelog } : {},
  );
  return data;
}

export async function restoreVersion(
  kbId: string,
  articleId: string,
  version: number,
  changelog?: string,
): Promise<unknown> {
  const { data } = await apiClient.post(
    `/knowledge-bases/${kbId}/articles/${articleId}/versions/${version}/restore`,
    changelog ? { changelog } : {},
  );
  return data;
}

export async function diffVersions(
  kbId: string,
  articleId: string,
  from: number,
  to: number,
): Promise<VersionDiff> {
  const { data } = await apiClient.get<VersionDiff>(
    `/knowledge-bases/${kbId}/articles/${articleId}/versions/${from}/diff`,
    { params: { to } },
  );
  return data;
}
