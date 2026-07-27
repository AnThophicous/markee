import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getProfile,
  updateProfile,
  uploadProfileImage,
  type ProfilePatch,
} from '../services/profile.service';

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: () => getProfile(userId as string),
    enabled: Boolean(userId),
  });
}

export function useUpdateProfile(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: ProfilePatch) => updateProfile(userId as string, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    },
  });
}

/** Sobe a imagem e já grava a URL no perfil — as duas coisas ou nenhuma. */
export function useUploadProfileImage(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ kind, uri }: { kind: 'avatar' | 'banner'; uri: string }) => {
      const publicUrl = await uploadProfileImage(userId as string, kind, uri);
      return updateProfile(userId as string, kind === 'avatar' ? { avatarUrl: publicUrl } : { bannerUrl: publicUrl });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    },
  });
}
