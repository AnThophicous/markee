import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  createNote,
  emptyTrash,
  permanentlyDeleteNote,
  restoreNote,
  softDeleteNote,
  updateNote,
  type NotePatch,
} from '../services/notes.service';

function useInvalidateNotes() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['notes'] });
    queryClient.invalidateQueries({ queryKey: ['tags'] });
  };
}

type CreateNoteInput = { folderId?: string | null; title?: string; content?: string } | undefined;

export function useCreateNote() {
  const invalidate = useInvalidateNotes();
  return useMutation({
    mutationFn: (input: CreateNoteInput) => createNote(input ?? {}),
    onSuccess: invalidate,
  });
}

export function useUpdateNote() {
  const invalidate = useInvalidateNotes();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: NotePatch }) => updateNote(id, patch),
    onSuccess: invalidate,
  });
}

export function useSoftDeleteNote() {
  const invalidate = useInvalidateNotes();
  return useMutation({
    mutationFn: (id: string) => softDeleteNote(id),
    onSuccess: invalidate,
  });
}

export function useRestoreNote() {
  const invalidate = useInvalidateNotes();
  return useMutation({
    mutationFn: (id: string) => restoreNote(id),
    onSuccess: invalidate,
  });
}

export function usePermanentlyDeleteNote() {
  const invalidate = useInvalidateNotes();
  return useMutation({
    mutationFn: (id: string) => permanentlyDeleteNote(id),
    onSuccess: invalidate,
  });
}

export function useEmptyTrash() {
  const invalidate = useInvalidateNotes();
  return useMutation({
    mutationFn: () => emptyTrash(),
    onSuccess: invalidate,
  });
}
