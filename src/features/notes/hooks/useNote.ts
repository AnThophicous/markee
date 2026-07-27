import { useQuery } from '@tanstack/react-query';

import { getNote } from '../services/notes.service';
import { noteKeys } from './keys';

export function useNote(id: string | undefined) {
  return useQuery({
    queryKey: noteKeys.detail(id ?? ''),
    queryFn: () => getNote(id as string),
    enabled: Boolean(id),
  });
}
