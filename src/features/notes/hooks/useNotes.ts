import { useQuery } from '@tanstack/react-query';

import { listNotes, searchNotes, type NoteFilter } from '../services/notes.service';
import { noteKeys } from './keys';

export function useNotes(filter: NoteFilter = {}) {
  return useQuery({
    queryKey: noteKeys.list(filter),
    queryFn: () => listNotes(filter),
  });
}

export function useSearchNotes(query: string, filter: { tagName?: string; folderId?: string } = {}) {
  return useQuery({
    queryKey: noteKeys.search(query, filter),
    queryFn: () => searchNotes(query, filter),
    enabled: query.trim().length > 0,
  });
}
