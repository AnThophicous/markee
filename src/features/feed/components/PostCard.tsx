import { Image, Pressable, Share, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';
import { formatRelativeDate } from '@/utils/date';
import type { FeedPost } from '../services/feed.service';
import { PollBlock } from './PollBlock';
import { PostImageGrid } from './PostImageGrid';

type PostCardProps = {
  post: FeedPost;
  canModerate: boolean;
  isAuthor: boolean;
  onToggleLike: () => void;
  onOpenComments: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
  onEdit?: () => void;
  onVote: (optionId: string) => void;
};

/** Acima disto o texto é cortado no cartão e o post pede para ser aberto. */
const PREVIEW_LINES = 8;
const PREVIEW_CHARS = 420;

export function PostCard({
  post,
  canModerate,
  isAuthor,
  onToggleLike,
  onOpenComments,
  onTogglePin,
  onDelete,
  onEdit,
  onVote,
}: PostCardProps) {
  const { tokens } = useTheme();
  const router = useRouter();

  const openPost = () =>
    router.push({ pathname: '/groups/[id]/post/[postId]', params: { id: post.groupId, postId: post.id } });

  const openAuthor = () => router.push({ pathname: '/u/[id]', params: { id: post.authorId } });

  const share = () =>
    Share.share({ message: `${post.authorName} no Markee:\n\n${post.content}` });

  const truncated = post.content.length > PREVIEW_CHARS;

  return (
    <View className="mb-2 bg-surface-light px-4 py-3.5 dark:bg-surface-dark">
      {post.isPinned ? (
        <View className="mb-2 flex-row items-center gap-1.5">
          <Feather name="bookmark" size={12} color={tokens.accent} />
          <AppText variant="small" className="text-accent">
            Fixado
          </AppText>
        </View>
      ) : null}

      <View className="flex-row items-center gap-2.5">
        <Pressable onPress={openAuthor} hitSlop={6}>
          {post.authorAvatar ? (
            <Image source={{ uri: post.authorAvatar }} className="h-9 w-9 rounded-full" />
          ) : (
            <View className="h-9 w-9 items-center justify-center rounded-full bg-subtle-light dark:bg-subtle-dark">
              <AppText variant="small">{post.authorName.charAt(0).toUpperCase()}</AppText>
            </View>
          )}
        </Pressable>

        <Pressable onPress={openAuthor} className="flex-1">
          <AppText variant="bodyEmphasis" numberOfLines={1}>
            {post.authorName}
          </AppText>
          <AppText variant="small">
            {formatRelativeDate(new Date(post.createdAt).getTime())}
            {post.editedAt ? ' · editado' : ''}
          </AppText>
        </Pressable>

        {canModerate || isAuthor ? (
          <View className="flex-row">
            {canModerate ? (
              <Pressable onPress={onTogglePin} hitSlop={8} className="h-9 w-9 items-center justify-center">
                <Feather name="bookmark" size={16} color={post.isPinned ? tokens.accent : tokens.muted} />
              </Pressable>
            ) : null}
            {isAuthor && onEdit ? (
              <Pressable onPress={onEdit} hitSlop={8} className="h-9 w-9 items-center justify-center">
                <Feather name="edit-2" size={15} color={tokens.muted} />
              </Pressable>
            ) : null}
            <Pressable onPress={onDelete} hitSlop={8} className="h-9 w-9 items-center justify-center">
              <Feather name="trash-2" size={16} color={tokens.muted} />
            </Pressable>
          </View>
        ) : null}
      </View>

      {post.content ? (
        <Pressable onPress={openPost}>
          <AppText variant="body" className="mt-2.5" numberOfLines={PREVIEW_LINES}>
            {post.content}
          </AppText>
          {truncated ? (
            <AppText variant="caption" className="mt-1 text-accent">
              Ler tudo
            </AppText>
          ) : null}
        </Pressable>
      ) : null}

      {post.poll ? <PollBlock poll={post.poll} onVote={onVote} /> : null}

      <PostImageGrid images={post.images} />

      <View className="mt-3 flex-row items-center gap-5">
        <Pressable onPress={onToggleLike} hitSlop={8} className="flex-row items-center gap-1.5">
          <Feather name="heart" size={17} color={post.likedByMe ? tokens.accent : tokens.muted} />
          <AppText variant="caption" className={post.likedByMe ? 'text-accent' : undefined}>
            {post.likeCount > 0 ? post.likeCount : 'Curtir'}
          </AppText>
        </Pressable>

        <Pressable onPress={onOpenComments} hitSlop={8} className="flex-row items-center gap-1.5">
          <Feather name="message-circle" size={17} color={tokens.muted} />
          <AppText variant="caption">{post.commentCount > 0 ? post.commentCount : 'Comentar'}</AppText>
        </Pressable>

        <Pressable onPress={share} hitSlop={8} className="flex-row items-center gap-1.5">
          <Feather name="share-2" size={17} color={tokens.muted} />
          <AppText variant="caption">Compartilhar</AppText>
        </Pressable>

        <View className="flex-1" />

        <Pressable onPress={openPost} hitSlop={8} className="h-8 w-8 items-center justify-center">
          <Feather name="maximize-2" size={15} color={tokens.muted} />
        </Pressable>
      </View>
    </View>
  );
}
