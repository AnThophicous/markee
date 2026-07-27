import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createFolder, deleteFolder, listFolders, renameFolder } from '../services/folders.service';

const foldersKey = ['folders'] as const;

export function useFolders() {
  return useQuery({
    queryKey: foldersKey,
    queryFn: listFolders,
  });
}

function useInvalidateFolders() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: foldersKey });
    queryClient.invalidateQueries({ queryKey: ['notes'] });
  };
}

export function useCreateFolder() {
  const invalidate = useInvalidateFolders();
  return useMutation({
    mutationFn: ({ name, parentId }: { name: string; parentId?: string | null }) =>
      createFolder(name, parentId ?? null),
    onSuccess: invalidate,
  });
}

export function useRenameFolder() {
  const invalidate = useInvalidateFolders();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameFolder(id, name),
    onSuccess: invalidate,
  });
}

export function useDeleteFolder() {
  const invalidate = useInvalidateFolders();
  return useMutation({
    mutationFn: (id: string) => deleteFolder(id),
    onSuccess: invalidate,
  });
}
