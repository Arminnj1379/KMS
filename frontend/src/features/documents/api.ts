import { apiClient } from '../../shared/lib/api-client';

export interface UploadIntent {
  objectKey: string;
  uploadUrl: string;
  expiresIn: number;
  mime: string;
  sizeBytes: number;
}

export interface KmsDocument {
  id: string;
  filename: string;
  mime: string;
  sizeBytes: number;
  uploaderId: string;
  createdAt: string;
  downloadUrl?: string;
}

export interface ArticleAttachmentEnriched extends KmsDocument {
  attachedBy: string;
  attachedAt: string;
}

export async function requestUploadIntent(input: {
  filename: string;
  mime: string;
  sizeBytes: number;
}): Promise<UploadIntent> {
  const { data } = await apiClient.post<UploadIntent>('/documents/upload-intent', input);
  return data;
}

/** Local-driver byte sink (S3 URLs are absolute and use plain fetch instead). */
export async function uploadLocalBytes(uploadUrl: string, file: File): Promise<void> {
  await apiClient.put(uploadUrl, file, {
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    timeout: 120000,
  });
}

export async function confirmDocument(input: {
  objectKey: string;
  filename?: string;
  mime?: string;
  sizeBytes?: number;
  kbId?: string;
  articleId?: string;
}): Promise<KmsDocument> {
  const { data } = await apiClient.post<KmsDocument>('/documents/confirm', input);
  return data;
}

export async function listAttachments(kbId: string, articleId: string): Promise<ArticleAttachmentEnriched[]> {
  const { data } = await apiClient.get<ArticleAttachmentEnriched[]>(
    `/knowledge-bases/${kbId}/articles/${articleId}/attachments`,
  );
  return data;
}

export async function attachExisting(
  kbId: string,
  articleId: string,
  documentId: string,
): Promise<ArticleAttachmentEnriched> {
  const { data } = await apiClient.post<ArticleAttachmentEnriched>(
    `/knowledge-bases/${kbId}/articles/${articleId}/attachments`,
    { documentId },
  );
  return data;
}

export async function detachAttachment(kbId: string, articleId: string, documentId: string): Promise<void> {
  await apiClient.delete(`/knowledge-bases/${kbId}/articles/${articleId}/attachments/${documentId}`);
}

export async function downloadAttachmentBlob(documentId: string): Promise<{ blob: Blob; filename: string }> {
  const res = await apiClient.get(`/documents/${documentId}/file`, { responseType: 'blob' });
  const disposition = (res.headers?.['content-disposition'] as string | undefined) ?? '';
  const match = /filename\*=UTF-8''([^;]+)/.exec(disposition) ?? /filename="([^"]+)"/.exec(disposition);
  const filename = match?.[1] ? decodeURIComponent(match[1]) : documentId;
  return { blob: res.data as Blob, filename };
}

/** Convenience: intent → bytes → confirm+attach in one call. */
export async function uploadAndAttach(
  kbId: string,
  articleId: string,
  file: File,
): Promise<ArticleAttachmentEnriched> {
  const intent = await requestUploadIntent({ filename: file.name, mime: file.type, sizeBytes: file.size });
  if (/^https?:\/\//.test(intent.uploadUrl)) {
    await fetch(intent.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
  } else {
    await uploadLocalBytes(intent.uploadUrl, file);
  }
  const doc = await confirmDocument({
    objectKey: intent.objectKey,
    filename: file.name,
    mime: file.type,
    sizeBytes: file.size,
  });
  return attachExisting(kbId, articleId, doc.id);
}
