import { useQuery } from '@tanstack/react-query';

import { listTags } from '../services/tags.service';

export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: listTags,
  });
}
