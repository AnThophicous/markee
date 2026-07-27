import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { listMessages, sendMessage, subscribeToRoom, type ChatMessage } from '../services/messages.service';

const roomKey = (roomId: string) => ['messages', roomId] as const;

export function useMessages(roomId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: roomKey(roomId ?? ''),
    queryFn: () => listMessages(roomId as string),
    enabled: Boolean(roomId),
  });

  useEffect(() => {
    if (!roomId) return;

    return subscribeToRoom(roomId, (message) => {
      queryClient.setQueryData<ChatMessage[]>(roomKey(roomId), (current = []) => {
        if (current.some((item) => item.id === message.id)) return current;
        return [...current, message];
      });
    });
  }, [roomId, queryClient]);

  return query;
}

export function useSendMessage(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => sendMessage(roomId, content),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roomKey(roomId) }),
  });
}
