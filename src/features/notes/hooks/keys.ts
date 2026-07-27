import type { NoteFilter } from '../services/notes.service';

export const noteKeys = {
  all: ['notes'] as const,
  list: (filter: NoteFilter) => ['notes', 'list', filter] as const,
  detail: (id: string) => ['notes', 'detail', id] as const,
  search: (query: string, filter: { tagName?: string; folderId?: string }) =>
    ['notes', 'search', query, filter] as const,
};
