import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addComment,
  createPost,
  deleteComment,
  deletePost,
  editPost,
  getPost,
  listComments,
  listPosts,
  setPinned,
  toggleLike,
  votePoll,
  type NewPost,
} from '../services/feed.service';

const feedKey = (groupId: string) => ['feed', groupId] as const;
const postKey = (postId: string) => ['feed', 'post', postId] as const;
const commentsKey = (postId: string) => ['feed', 'comments', postId] as const;

export function usePosts(groupId: string | undefined) {
  return useQuery({
    queryKey: feedKey(groupId ?? ''),
    queryFn: () => listPosts(groupId as string),
    enabled: Boolean(groupId),
  });
}

export function usePost(postId: string | undefined) {
  return useQuery({
    queryKey: postKey(postId ?? ''),
    queryFn: () => getPost(postId as string),
    enabled: Boolean(postId),
  });
}

export function useCreatePost(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewPost) => createPost(groupId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: feedKey(groupId) }),
  });
}

export function useEditPost(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, content }: { postId: string; content: string }) => editPost(postId, content),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: feedKey(groupId) });
      queryClient.invalidateQueries({ queryKey: postKey(variables.postId) });
    },
  });
}

export function useToggleLike(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, liked }: { postId: string; liked: boolean }) => toggleLike(postId, liked),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: feedKey(groupId) });
      queryClient.invalidateQueries({ queryKey: postKey(variables.postId) });
    },
  });
}

export function useVotePoll(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ optionId }: { optionId: string; postId: string }) => votePoll(optionId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: feedKey(groupId) });
      queryClient.invalidateQueries({ queryKey: postKey(variables.postId) });
    },
  });
}

export function useDeletePost(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => deletePost(postId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: feedKey(groupId) }),
  });
}

export function useSetPinned(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, pinned }: { postId: string; pinned: boolean }) => setPinned(postId, pinned),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: feedKey(groupId) }),
  });
}

export function useComments(postId: string | undefined) {
  return useQuery({
    queryKey: commentsKey(postId ?? ''),
    queryFn: () => listComments(postId as string),
    enabled: Boolean(postId),
  });
}

export function useAddComment(groupId: string, postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ content, parentId }: { content: string; parentId?: string | null }) =>
      addComment(postId, content, parentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentsKey(postId) });
      queryClient.invalidateQueries({ queryKey: postKey(postId) });
      queryClient.invalidateQueries({ queryKey: feedKey(groupId) });
    },
  });
}

export function useDeleteComment(groupId: string, postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => deleteComment(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentsKey(postId) });
      queryClient.invalidateQueries({ queryKey: postKey(postId) });
      queryClient.invalidateQueries({ queryKey: feedKey(groupId) });
    },
  });
}
