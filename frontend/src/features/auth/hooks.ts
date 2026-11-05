import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  changePassword,
  clearTokens,
  fetchMe,
  inviteUser,
  listUsers,
  login,
  logout,
  readTokens,
  register,
  updateUser,
} from './api';
import type { InviteInput, LoginInput, RegisterInput } from './schemas';

export const authKeys = {
  me: ['auth', 'me'] as const,
  users: (search: string) => ['auth', 'users', search] as const,
};

export function useMe(enabled = true) {
  const { access } = readTokens();
  return useQuery({
    queryKey: authKeys.me,
    queryFn: fetchMe,
    enabled: enabled && access !== null,
    retry: false,
    staleTime: 60_000,
  });
}

export function useLogin() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => login(input.email, input.password),
    onSuccess: (res) => {
      client.setQueryData(authKeys.me, { user: res.user, memberships: [] });
    },
  });
}

export function useRegister() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      register({
        fullName: input.fullName,
        email: input.email,
        password: input.password,
        organizationName: input.organizationName,
      }),
    onSuccess: (res) => {
      client.setQueryData(authKeys.me, { user: res.user, memberships: [] });
    },
  });
}

export function useLogout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => logout(),
    onSettled: () => {
      clearTokens();
      client.removeQueries({ queryKey: ['auth'] });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      changePassword(currentPassword, newPassword),
  });
}

export function useUsers(search: string, enabled = true) {
  return useQuery({
    queryKey: authKeys.users(search),
    queryFn: () => listUsers({ page: 1, pageSize: 50, search: search || undefined }),
    enabled,
  });
}

export function useInviteUser() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: InviteInput) => inviteUser(input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['auth', 'users'] });
    },
  });
}

export function useUpdateUser() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: { isActive?: boolean; role?: 'org-admin' | 'member' } }) =>
      updateUser(id, input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['auth', 'users'] });
    },
  });
}
