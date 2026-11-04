import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addKbMember,
  createCategory,
  createKb,
  deleteCategory,
  deleteKb,
  getKb,
  listCategories,
  listKbs,
  listKbMembers,
  removeKbMember,
  updateCategory,
  updateKb,
  updateKbMemberRole,
} from './api';

export const kbKeys = {
  all: ['kbs'] as const,
  detail: (id: string) => ['kbs', id] as const,
  members: (id: string) => ['kbs', id, 'members'] as const,
  categories: (id: string) => ['kbs', id, 'categories'] as const,
};

export function useKbs() {
  return useQuery({ queryKey: kbKeys.all, queryFn: listKbs });
}

export function useKb(id: string) {
  return useQuery({ queryKey: kbKeys.detail(id), queryFn: () => getKb(id) });
}

export function useCreateKb() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createKb,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: kbKeys.all });
    },
  });
}

export function useUpdateKb(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof updateKb>[1]) => updateKb(id, input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: kbKeys.detail(id) });
      void client.invalidateQueries({ queryKey: kbKeys.all });
    },
  });
}

export function useDeleteKb(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => deleteKb(id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: kbKeys.all });
    },
  });
}

export function useKbMembers(id: string) {
  return useQuery({ queryKey: kbKeys.members(id), queryFn: () => listKbMembers(id) });
}

export function useAddKbMember(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; role: string }) => addKbMember(id, input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: kbKeys.members(id) });
      void client.invalidateQueries({ queryKey: kbKeys.detail(id) });
    },
  });
}

export function useUpdateKbMemberRole(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      updateKbMemberRole(id, userId, role),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: kbKeys.members(id) });
    },
  });
}

export function useRemoveKbMember(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => removeKbMember(id, userId),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: kbKeys.members(id) });
      void client.invalidateQueries({ queryKey: kbKeys.detail(id) });
    },
  });
}

export function useCategories(kbId: string) {
  return useQuery({ queryKey: kbKeys.categories(kbId), queryFn: () => listCategories(kbId) });
}

function useInvalidateCategories(kbId: string) {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: kbKeys.categories(kbId) });
    void client.invalidateQueries({ queryKey: kbKeys.detail(kbId) });
  };
}

export function useCreateCategory(kbId: string) {
  const invalidate = useInvalidateCategories(kbId);
  return useMutation({
    mutationFn: (input: { title: string; slug: string; description?: string; parentId?: string }) =>
      createCategory(kbId, input),
    onSuccess: invalidate,
  });
}

export function useUpdateCategory(kbId: string) {
  const invalidate = useInvalidateCategories(kbId);
  return useMutation({
    mutationFn: ({ catId, input }: { catId: string; input: { title?: string; description?: string; parentId?: string | null } }) =>
      updateCategory(kbId, catId, input),
    onSuccess: invalidate,
  });
}

export function useDeleteCategory(kbId: string) {
  const invalidate = useInvalidateCategories(kbId);
  return useMutation({
    mutationFn: (catId: string) => deleteCategory(kbId, catId),
    onSuccess: invalidate,
  });
}
