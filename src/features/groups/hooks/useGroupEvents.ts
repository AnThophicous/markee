import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createEvent, deleteEvent, listEvents } from '../services/events.service';

const eventsKey = (groupId: string) => ['groups', groupId, 'events'] as const;

export function useGroupEvents(groupId: string | undefined) {
  return useQuery({
    queryKey: eventsKey(groupId ?? ''),
    queryFn: () => listEvents(groupId as string),
    enabled: Boolean(groupId),
  });
}

export function useCreateEvent(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; description?: string; startsAt: Date }) => createEvent(groupId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: eventsKey(groupId) }),
  });
}

export function useDeleteEvent(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => deleteEvent(eventId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: eventsKey(groupId) }),
  });
}
