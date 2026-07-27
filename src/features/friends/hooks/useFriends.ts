import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  acceptFriendRequest,
  getThreadPeer,
  listDmMessages,
  listFriends,
  openDm,
  regenerateFriendCode,
  removeFriend,
  sendDmMessage,
  sendFriendRequest,
  subscribeToDm,
  type DmMessage,
} from '../services/friends.service';

const friendsKey = ['friends'] as const;
const dmKey = (threadId: string) => ['dm', threadId] as const;

export function useFriends() {
  return useQuery({ queryKey: friendsKey, queryFn: listFriends });
}

export function useSendFriendRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (friendCode: string) => sendFriendRequest(friendCode),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: friendsKey }),
  });
}

export function useAcceptFriend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => acceptFriendRequest(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: friendsKey }),
  });
}

export function useRemoveFriend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => removeFriend(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: friendsKey }),
  });
}

export function useRegenerateFriendCode(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => regenerateFriendCode(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile', userId] }),
  });
}

export function useOpenDm() {
  return useMutation({ mutationFn: (userId: string) => openDm(userId) });
}

export function useDmMessages(threadId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: dmKey(threadId ?? ''),
    queryFn: () => listDmMessages(threadId as string),
    enabled: Boolean(threadId),
  });

  useEffect(() => {
    if (!threadId) return;

    return subscribeToDm(threadId, (message) => {
      queryClient.setQueryData<DmMessage[]>(dmKey(threadId), (current = []) => {
        if (current.some((item) => item.id === message.id)) return current;
        return [...current, message];
      });
    });
  }, [threadId, queryClient]);

  return query;
}

export function useSendDm(threadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => sendDmMessage(threadId, content),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: dmKey(threadId) }),
  });
}

/** Quem está do outro lado da conversa, com a chave pública dela. */
export function useThreadPeer(threadId: string | undefined) {
  return useQuery({
    queryKey: ['dm', 'peer', threadId ?? ''],
    queryFn: () => getThreadPeer(threadId as string),
    enabled: Boolean(threadId),
  });
}
