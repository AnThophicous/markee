import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  assignRole,
  createGroup,
  createRole,
  createRoom,
  deleteGroup,
  deleteRole,
  getGroup,
  getMyPermissions,
  joinGroupByCode,
  kickMember,
  leaveGroup,
  listMembers,
  listMyGroups,
  listRoles,
  listRooms,
  updateGroup,
  updateRolePermissions,
} from '../services/groups.service';

export const groupKeys = {
  all: ['groups'] as const,
  detail: (id: string) => ['groups', id] as const,
  rooms: (id: string) => ['groups', id, 'rooms'] as const,
  roles: (id: string) => ['groups', id, 'roles'] as const,
  members: (id: string) => ['groups', id, 'members'] as const,
  permissions: (id: string) => ['groups', id, 'permissions'] as const,
};

export function useMyGroups() {
  return useQuery({ queryKey: groupKeys.all, queryFn: listMyGroups });
}

export function useGroup(groupId: string | undefined) {
  return useQuery({
    queryKey: groupKeys.detail(groupId ?? ''),
    queryFn: () => getGroup(groupId as string),
    enabled: Boolean(groupId),
  });
}

export function useRooms(groupId: string | undefined) {
  return useQuery({
    queryKey: groupKeys.rooms(groupId ?? ''),
    queryFn: () => listRooms(groupId as string),
    enabled: Boolean(groupId),
  });
}

export function useRoles(groupId: string | undefined) {
  return useQuery({
    queryKey: groupKeys.roles(groupId ?? ''),
    queryFn: () => listRoles(groupId as string),
    enabled: Boolean(groupId),
  });
}

export function useMembers(groupId: string | undefined) {
  return useQuery({
    queryKey: groupKeys.members(groupId ?? ''),
    queryFn: () => listMembers(groupId as string),
    enabled: Boolean(groupId),
  });
}

export function useMyPermissions(groupId: string | undefined) {
  return useQuery({
    queryKey: groupKeys.permissions(groupId ?? ''),
    queryFn: () => getMyPermissions(groupId as string),
    enabled: Boolean(groupId),
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, description }: { name: string; description?: string }) => createGroup(name, description),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: groupKeys.all }),
  });
}

export function useJoinGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => joinGroupByCode(code),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: groupKeys.all }),
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => deleteGroup(groupId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: groupKeys.all }),
  });
}

export function useLeaveGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => leaveGroup(groupId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: groupKeys.all }),
  });
}

export function useUpdateGroup(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Parameters<typeof updateGroup>[1]) => updateGroup(groupId, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
      queryClient.invalidateQueries({ queryKey: groupKeys.all });
    },
  });
}

export function useCreateRoom(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createRoom(groupId, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: groupKeys.rooms(groupId) }),
  });
}

export function useCreateRole(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, permissions }: { name: string; permissions: number }) =>
      createRole(groupId, name, permissions),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: groupKeys.roles(groupId) }),
  });
}

export function useUpdateRole(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, permissions }: { roleId: string; permissions: number }) =>
      updateRolePermissions(roleId, permissions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.roles(groupId) });
      queryClient.invalidateQueries({ queryKey: groupKeys.permissions(groupId) });
    },
  });
}

export function useDeleteRole(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roleId: string) => deleteRole(roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.roles(groupId) });
      queryClient.invalidateQueries({ queryKey: groupKeys.members(groupId) });
    },
  });
}

export function useAssignRole(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string | null }) =>
      assignRole(groupId, userId, roleId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: groupKeys.members(groupId) }),
  });
}

export function useKickMember(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => kickMember(groupId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: groupKeys.members(groupId) }),
  });
}
