import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  attachExisting,
  detachAttachment,
  listAttachments,
  uploadAndAttach,
} from './api';

export const attachmentKeys = {
  list: (kbId: string, articleId: string) => ['kbs', kbId, 'articles', articleId, 'attachments'] as const,
};

export function useAttachments(kbId: string, articleId: string) {
  return useQuery({ queryKey: attachmentKeys.list(kbId, articleId), queryFn: () => listAttachments(kbId, articleId) });
}

export function useUploadAttachment(kbId: string, articleId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadAndAttach(kbId, articleId, file),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: attachmentKeys.list(kbId, articleId) });
      void client.invalidateQueries({ queryKey: ['kbs', kbId, 'articles', articleId] });
    },
  });
}

export function useDetachAttachment(kbId: string, articleId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => detachAttachment(kbId, articleId, documentId),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: attachmentKeys.list(kbId, articleId) });
      void client.invalidateQueries({ queryKey: ['kbs', kbId, 'articles', articleId] });
    },
  });
}

export function useAttachExisting(kbId: string, articleId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => attachExisting(kbId, articleId, documentId),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: attachmentKeys.list(kbId, articleId) });
      void client.invalidateQueries({ queryKey: ['kbs', kbId, 'articles', articleId] });
    },
  });
}
