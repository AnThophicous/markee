import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Divider } from '@/components/Divider';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { useSession } from '@/features/auth/hooks/useSession';
import { PollBlock } from '@/features/feed/components/PollBlock';
import { PostImageGrid } from '@/features/feed/components/PostImageGrid';
import {
  useAddComment,
  useComments,
  useDeleteComment,
  usePost,
  useToggleLike,
  useVotePoll,
} from '@/features/feed/hooks/useFeed';
import type { PostComment } from '@/features/feed/services/feed.service';
import { useGroupIdentity, type IdentidadeNoGrupo } from '@/features/groups/hooks/useGroupIdentity';
import { useMyPermissions } from '@/features/groups/hooks/useGroups';
import { Permission, hasPermission } from '@/features/groups/permissions';
import { ScreenHeader } from '@/features/navigation/components/ScreenHeader';
import { useBottomInset } from '@/hooks/useBottomInset';
import { useTheme } from '@/theme/ThemeProvider';
import { formatRelativeDate } from '@/utils/date';

/** Post aberto por inteiro: texto sem corte, fotos com zoom e comentários em thread. */
export default function PostDetailScreen() {
  const { id, postId } = useLocalSearchParams<{ id: string; postId: string }>();
  const router = useRouter();
  const { tokens } = useTheme();
  const { user } = useSession();
  const bottom = useBottomInset(8);

  const { data: post, isLoading } = usePost(postId);
  const { data: comments } = useComments(postId);
  const { data: perms } = useMyPermissions(id);
  const identidade = useGroupIdentity(id);
  const toggleLike = useToggleLike(id ?? '');
  const votePoll = useVotePoll(id ?? '');
  const addComment = useAddComment(id ?? '', postId ?? '');
  const deleteComment = useDeleteComment(id ?? '', postId ?? '');

  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<PostComment | null>(null);

  const canModerate = hasPermission(perms?.permissions ?? 0, Permission.MANAGE_POSTS, perms?.isOwner ?? false);

  const send = () => {
    if (!draft.trim()) return;
    addComment.mutate(
      { content: draft, parentId: replyTo?.id ?? null },
      {
        onSuccess: () => {
          setDraft('');
          setReplyTo(null);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <Screen className="items-center justify-center">
        <ActivityIndicator color={tokens.accent} />
      </Screen>
    );
  }

  if (!post) {
    return (
      <Screen>
        <ScreenHeader title="Publicação" showMenu={false} onBackPress={() => router.back()} />
        <EmptyState icon="alert-circle" title="Publicação não encontrada" subtitle="Ela pode ter sido apagada." />
      </Screen>
    );
  }

  // Depois das guardas de carregando/não encontrado, para não resolver a
  // identidade de um post que talvez nem exista.
  const autor = identidade(post.authorId, post.authorName);

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-canvas-light dark:bg-canvas-dark"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader
        title="Publicação"
        showMenu={false}
        onBackPress={() => router.back()}
        rightIcon="share-2"
        onRightPress={() => Share.share({ message: `${autor.nome} no Markee:\n\n${post.content}` })}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
        <View className="px-4 pt-1">
          {post.isPinned ? (
            <View className="mb-2 flex-row items-center gap-1.5">
              <Feather name="bookmark" size={12} color={tokens.accent} />
              <AppText variant="small" className="text-accent">
                Fixado
              </AppText>
            </View>
          ) : null}

          <Pressable
            onPress={() => router.push({ pathname: '/u/[id]', params: { id: post.authorId } })}
            className="flex-row items-center gap-2.5"
          >
            {post.authorAvatar ? (
              <Image source={{ uri: post.authorAvatar }} className="h-11 w-11 rounded-full" />
            ) : (
              <View className="h-11 w-11 items-center justify-center rounded-full bg-subtle-light dark:bg-subtle-dark">
                <AppText variant="bodyEmphasis">{autor.nome.charAt(0).toUpperCase()}</AppText>
              </View>
            )}
            <View className="flex-1">
              <AppText variant="bodyEmphasis" style={{ color: autor.cor }}>
                {autor.nome}
              </AppText>
              <AppText variant="small">
                {formatRelativeDate(new Date(post.createdAt).getTime())}
                {post.editedAt ? ' · editado' : ''}
              </AppText>
            </View>
            <Feather name="chevron-right" size={16} color={tokens.muted} />
          </Pressable>

          {post.content ? (
            <AppText variant="body" className="mt-3" selectable>
              {post.content}
            </AppText>
          ) : null}

          {post.poll ? (
            <PollBlock poll={post.poll} onVote={(optionId) => votePoll.mutate({ optionId, postId: post.id })} />
          ) : null}

          <PostImageGrid images={post.images} variant="detail" />

          <View className="mt-4 flex-row items-center gap-6">
            <Pressable
              onPress={() => toggleLike.mutate({ postId: post.id, liked: post.likedByMe })}
              hitSlop={8}
              className="flex-row items-center gap-1.5"
            >
              <Feather name="heart" size={19} color={post.likedByMe ? tokens.accent : tokens.muted} />
              <AppText variant="caption" className={post.likedByMe ? 'text-accent' : undefined}>
                {post.likeCount > 0 ? post.likeCount : 'Curtir'}
              </AppText>
            </Pressable>

            <View className="flex-row items-center gap-1.5">
              <Feather name="message-circle" size={19} color={tokens.muted} />
              <AppText variant="caption">{post.commentCount}</AppText>
            </View>
          </View>
        </View>

        <Divider className="my-4" />

        <View className="px-4">
          <AppText variant="small" className="mb-2">
            COMENTÁRIOS
          </AppText>

          {(comments ?? []).length === 0 ? (
            <AppText variant="caption" className="py-6 text-center">
              Ninguém comentou ainda. Comece a conversa.
            </AppText>
          ) : (
            (comments ?? []).map((comment) => (
              <CommentRow
                key={comment.id}
                comment={comment}
                depth={0}
                currentUserId={user?.id}
                canModerate={canModerate}
                identidade={identidade}
                onReply={setReplyTo}
                onDelete={(commentId) => deleteComment.mutate(commentId)}
              />
            ))
          )}
        </View>
      </ScrollView>

      <View
        style={{ paddingBottom: bottom }}
        className="border-t border-hairline-light bg-surface-light px-3 pt-2 dark:border-hairline-dark dark:bg-surface-dark"
      >
        {replyTo ? (
          <View className="mb-1.5 flex-row items-center gap-2 px-1">
            <Feather name="corner-down-right" size={13} color={tokens.accent} />
            <AppText variant="small" className="flex-1 text-accent">
              Respondendo {identidade(replyTo.authorId, replyTo.authorName).nome}
            </AppText>
            <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
              <Feather name="x" size={14} color={tokens.muted} />
            </Pressable>
          </View>
        ) : null}

        <View className="flex-row items-end gap-2">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={replyTo ? 'Escreva sua resposta' : 'Escreva um comentário'}
            placeholderTextColor={tokens.muted}
            multiline
            className="max-h-28 flex-1 rounded-2xl bg-subtle-light px-4 py-2.5 text-[16px] text-ink-light dark:bg-subtle-dark dark:text-ink-dark"
          />
          <Pressable
            onPress={send}
            disabled={!draft.trim() || addComment.isPending}
            className={`h-11 w-11 items-center justify-center rounded-full ${
              draft.trim() ? 'bg-accent' : 'bg-subtle-light dark:bg-subtle-dark'
            }`}
          >
            <Feather name="arrow-up" size={18} color={draft.trim() ? '#fff' : tokens.muted} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function CommentRow({
  comment,
  depth,
  currentUserId,
  canModerate,
  identidade,
  onReply,
  onDelete,
}: {
  comment: PostComment;
  depth: number;
  currentUserId: string | undefined;
  canModerate: boolean;
  /** Vem por prop, e não de um useGroupIdentity aqui dentro, porque uma thread
      tem dezenas de comentários: cada linha assinaria a consulta de novo. */
  identidade: (userId: string, nomeDeReserva?: string) => IdentidadeNoGrupo;
  onReply: (comment: PostComment) => void;
  onDelete: (commentId: string) => void;
}) {
  const { tokens } = useTheme();
  const router = useRouter();
  const canDelete = canModerate || comment.authorId === currentUserId;
  const quem = identidade(comment.authorId, comment.authorName);

  return (
    <View style={{ marginLeft: depth > 0 ? 28 : 0 }}>
      <View className="flex-row gap-2.5 py-2.5">
        <Pressable onPress={() => router.push({ pathname: '/u/[id]', params: { id: comment.authorId } })}>
          {comment.authorAvatar ? (
            <Image source={{ uri: comment.authorAvatar }} className="h-8 w-8 rounded-full" />
          ) : (
            <View className="h-8 w-8 items-center justify-center rounded-full bg-subtle-light dark:bg-subtle-dark">
              <AppText variant="small">{quem.nome.charAt(0).toUpperCase()}</AppText>
            </View>
          )}
        </Pressable>

        <View className="flex-1">
          <View className="flex-row items-baseline gap-2">
            <AppText variant="small" style={{ color: quem.cor }}>
              {quem.nome}
            </AppText>
            <AppText variant="small">{formatRelativeDate(new Date(comment.createdAt).getTime())}</AppText>
          </View>

          <AppText variant="body">{comment.content}</AppText>

          <View className="mt-1 flex-row items-center gap-4">
            {/* Respostas param num nível: thread de thread vira escada ilegível no celular. */}
            {depth === 0 ? (
              <Pressable onPress={() => onReply(comment)} hitSlop={8}>
                <AppText variant="small">Responder</AppText>
              </Pressable>
            ) : null}
            {canDelete ? (
              <Pressable onPress={() => onDelete(comment.id)} hitSlop={8}>
                <AppText variant="small" style={{ color: tokens.danger }}>
                  Apagar
                </AppText>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      {comment.replies.map((reply) => (
        <CommentRow
          key={reply.id}
          comment={reply}
          depth={depth + 1}
          currentUserId={currentUserId}
          canModerate={canModerate}
          identidade={identidade}
          onReply={onReply}
          onDelete={onDelete}
        />
      ))}
    </View>
  );
}
