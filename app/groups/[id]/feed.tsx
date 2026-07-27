import { useState } from 'react';
import { ActivityIndicator, RefreshControl, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { EmptyState } from '@/components/EmptyState';
import { useSession } from '@/features/auth/hooks/useSession';
import { ComposerSheet } from '@/features/feed/components/ComposerSheet';
import { PostCard } from '@/features/feed/components/PostCard';
import {
  useCreatePost,
  useDeletePost,
  useEditPost,
  usePosts,
  useSetPinned,
  useToggleLike,
  useVotePoll,
} from '@/features/feed/hooks/useFeed';
import type { NewPost } from '@/features/feed/services/feed.service';
import { useMyPermissions } from '@/features/groups/hooks/useGroups';
import { Permission, hasPermission } from '@/features/groups/permissions';
import { ScreenHeader } from '@/features/navigation/components/ScreenHeader';
import { useBottomInset } from '@/hooks/useBottomInset';
import { useTheme } from '@/theme/ThemeProvider';

export default function FeedScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { tokens } = useTheme();
  const { user } = useSession();
  const bottom = useBottomInset(16);

  const { data: posts, isLoading, refetch, isRefetching } = usePosts(id);
  const { data: perms } = useMyPermissions(id);
  const createPost = useCreatePost(id ?? '');
  const editPost = useEditPost(id ?? '');
  const toggleLike = useToggleLike(id ?? '');
  const deletePost = useDeletePost(id ?? '');
  const setPinned = useSetPinned(id ?? '');
  const votePoll = useVotePoll(id ?? '');

  const [composerVisible, setComposerVisible] = useState(false);
  const [editing, setEditing] = useState<{ id: string; content: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const permissions = perms?.permissions ?? 0;
  const isOwner = perms?.isOwner ?? false;
  const canPost = hasPermission(permissions, Permission.CREATE_POSTS, isOwner);
  const canModerate = hasPermission(permissions, Permission.MANAGE_POSTS, isOwner);

  const closeComposer = () => {
    setComposerVisible(false);
    setEditing(null);
    setError(null);
  };

  const submit = (post: NewPost) => {
    setError(null);
    if (editing) {
      editPost.mutate(
        { postId: editing.id, content: post.content },
        { onSuccess: closeComposer, onError: (e) => setError(e.message) }
      );
      return;
    }
    createPost.mutate(post, { onSuccess: closeComposer, onError: (e) => setError(e.message) });
  };

  return (
    <View className="flex-1 bg-canvas-light dark:bg-canvas-dark">
      <ScreenHeader
        title="Feed"
        showMenu={false}
        onBackPress={() => router.back()}
        rightIcon={canPost ? 'edit-3' : undefined}
        onRightPress={() => setComposerVisible(true)}
      />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={tokens.accent} />
        </View>
      ) : (posts ?? []).length === 0 ? (
        <EmptyState
          icon="message-square"
          title="Feed vazio"
          subtitle={canPost ? 'Publique o primeiro aviso da turma.' : 'Ainda não há publicações aqui.'}
        />
      ) : (
        <FlashList
          data={posts ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: bottom }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={tokens.accent} />}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              canModerate={canModerate}
              isAuthor={item.authorId === user?.id}
              onToggleLike={() => toggleLike.mutate({ postId: item.id, liked: item.likedByMe })}
              onOpenComments={() =>
                router.push({ pathname: '/groups/[id]/post/[postId]', params: { id: id ?? '', postId: item.id } })
              }
              onTogglePin={() => setPinned.mutate({ postId: item.id, pinned: !item.isPinned })}
              onDelete={() => deletePost.mutate(item.id)}
              onEdit={() => {
                setEditing({ id: item.id, content: item.content });
                setComposerVisible(true);
              }}
              onVote={(optionId) => votePoll.mutate({ optionId, postId: item.id })}
            />
          )}
        />
      )}

      <ComposerSheet
        visible={composerVisible}
        editing={editing}
        onClose={closeComposer}
        onPublish={submit}
        isPending={createPost.isPending || editPost.isPending}
        error={error}
      />
    </View>
  );
}
