import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/services/supabase';

export type PollOption = {
  id: string;
  label: string;
  position: number;
  voteCount: number;
  votedByMe: boolean;
};

export type Poll = {
  question: string;
  allowMultiple: boolean;
  closesAt: string | null;
  options: PollOption[];
  totalVotes: number;
};

export type FeedPost = {
  id: string;
  groupId: string;
  authorId: string;
  kind: 'text' | 'poll';
  content: string;
  createdAt: string;
  editedAt: string | null;
  isPinned: boolean;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  authorName: string;
  authorAvatar: string | null;
  images: string[];
  poll: Poll | null;
};

export type PostComment = {
  id: string;
  postId: string;
  parentId: string | null;
  authorId: string;
  content: string;
  createdAt: string;
  authorName: string;
  authorAvatar: string | null;
  replies: PostComment[];
};

const POST_SELECT =
  'id, group_id, author_id, kind, content, created_at, edited_at, is_pinned, like_count, comment_count, liked_by_me, ' +
  'profiles(display_name, avatar_url), post_images(url, position), ' +
  'post_polls(question, allow_multiple, closes_at)';

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapPoll(row: any, options: any[]): Poll | null {
  const poll = Array.isArray(row.post_polls) ? row.post_polls[0] : row.post_polls;
  if (!poll) return null;

  const mapped: PollOption[] = options
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((option) => ({
      id: option.id,
      label: option.label,
      position: option.position,
      voteCount: Number(option.vote_count ?? 0),
      votedByMe: Boolean(option.voted_by_me),
    }));

  return {
    question: poll.question,
    allowMultiple: Boolean(poll.allow_multiple),
    closesAt: poll.closes_at ?? null,
    options: mapped,
    totalVotes: mapped.reduce((total, option) => total + option.voteCount, 0),
  };
}

function mapPost(row: any, optionsByPost: Map<string, any[]>): FeedPost {
  return {
    id: row.id,
    groupId: row.group_id,
    authorId: row.author_id,
    kind: row.kind === 'poll' ? 'poll' : 'text',
    content: row.content,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    isPinned: row.is_pinned,
    likeCount: Number(row.like_count ?? 0),
    commentCount: Number(row.comment_count ?? 0),
    likedByMe: Boolean(row.liked_by_me),
    authorName: row.profiles?.display_name ?? 'Estudante',
    authorAvatar: row.profiles?.avatar_url ?? null,
    images: (row.post_images ?? [])
      .slice()
      .sort((a: any, b: any) => a.position - b.position)
      .map((image: any) => image.url),
    poll: mapPoll(row, optionsByPost.get(row.id) ?? []),
  };
}

/**
 * As opções de enquete vêm numa segunda consulta em vez de embutidas no post.
 * As contagens moram numa view (poll_options_with_counts) e o PostgREST não
 * embute view dentro de view — uma consulta a mais sai bem mais barato do que
 * N+1 por post.
 */
async function fetchPollOptions(postIds: string[]): Promise<Map<string, any[]>> {
  const map = new Map<string, any[]>();
  if (postIds.length === 0) return map;

  const { data, error } = await supabase
    .from('poll_options_with_counts')
    .select('id, post_id, label, position, vote_count, voted_by_me')
    .in('post_id', postIds);

  if (error) throw new Error(error.message);

  for (const option of data ?? []) {
    const list = map.get(option.post_id) ?? [];
    list.push(option);
    map.set(option.post_id, list);
  }
  return map;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function listPosts(groupId: string): Promise<FeedPost[]> {
  const { data, error } = await supabase
    .from('posts_with_counts')
    .select(POST_SELECT)
    .eq('group_id', groupId)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);

  // posts_with_counts é uma view com recursos embutidos; o supabase-js não
  // consegue inferir esse formato, então o mapeamento fica manual.
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const rows = (data ?? []) as any[];
  const options = await fetchPollOptions(rows.filter((row) => row.kind === 'poll').map((row) => row.id));

  return rows.map((row) => mapPost(row, options));
}

export async function getPost(postId: string): Promise<FeedPost | null> {
  const { data, error } = await supabase.from('posts_with_counts').select(POST_SELECT).eq('id', postId).maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const row = data as any;
  const options = row.kind === 'poll' ? await fetchPollOptions([row.id]) : new Map();
  return mapPost(row, options);
}

export type NewPost = {
  content: string;
  images?: string[];
  poll?: { question: string; options: string[]; allowMultiple: boolean };
};

export async function createPost(groupId: string, input: NewPost): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Você precisa estar logado.');

  const pollLabels = (input.poll?.options ?? []).map((option) => option.trim()).filter(Boolean);
  const isPoll = pollLabels.length >= 2;

  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      group_id: groupId,
      author_id: userId,
      content: input.content.trim(),
      kind: isPoll ? 'poll' : 'text',
    })
    .select('id')
    .single();

  if (error) {
    if (error.message.toLowerCase().includes('row-level security')) {
      throw new Error('Você não tem permissão para publicar neste grupo.');
    }
    throw new Error(error.message);
  }

  if (isPoll && input.poll) {
    const { error: pollError } = await supabase.from('post_polls').insert({
      post_id: post.id,
      question: input.poll.question.trim() || input.content.trim() || 'Enquete',
      allow_multiple: input.poll.allowMultiple,
    });
    if (pollError) throw new Error(pollError.message);

    const { error: optionsError } = await supabase
      .from('poll_options')
      .insert(pollLabels.map((label, position) => ({ post_id: post.id, label, position })));
    if (optionsError) throw new Error(optionsError.message);
  }

  for (const [index, uri] of (input.images ?? []).entries()) {
    const url = await uploadPostImage(userId, uri);
    const { error: imageError } = await supabase
      .from('post_images')
      .insert({ post_id: post.id, url, position: index });
    if (imageError) throw new Error(imageError.message);
  }

  return post.id;
}

export async function editPost(postId: string, content: string): Promise<void> {
  const { error } = await supabase.from('posts').update({ content: content.trim() }).eq('id', postId);
  if (error) throw new Error(error.message);
}

/** Imagens do feed também passam pelo nosso storage — nunca link de fora. */
async function uploadPostImage(userId: string, localUri: string): Promise<string> {
  const response = await fetch(localUri);
  const arrayBuffer = await response.arrayBuffer();

  const extension = localUri.split('.').pop()?.toLowerCase().split('?')[0] ?? 'jpg';
  const contentType = extension === 'png' ? 'image/png' : 'image/jpeg';
  const filePath = `${userId}/posts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

  const { error } = await supabase.storage.from('uploads').upload(filePath, arrayBuffer, { contentType });
  if (error) throw new Error(error.message);

  return supabase.storage.from('uploads').getPublicUrl(filePath).data.publicUrl;
}

export async function pickPostImages(): Promise<string[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Precisamos de acesso às suas fotos.');

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: 4,
    quality: 0.8,
  });
  if (result.canceled) return [];
  return result.assets.map((asset) => asset.uri);
}

export async function toggleLike(postId: string, liked: boolean): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Você precisa estar logado.');

  if (liked) {
    const { error } = await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('post_likes').insert({ post_id: postId, user_id: userId });
    if (error) throw new Error(error.message);
  }
}

/** Votar passa pela função no banco: ela aplica "escolha única" numa transação só. */
export async function votePoll(optionId: string): Promise<void> {
  const { error } = await supabase.rpc('vote_poll', { p_option_id: optionId });
  if (error) throw new Error(error.message);
}

export async function deletePost(postId: string): Promise<void> {
  const { error } = await supabase.from('posts').delete().eq('id', postId);
  if (error) throw new Error(error.message);
}

export async function setPinned(postId: string, pinned: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_post_pinned', { p_post_id: postId, p_pinned: pinned });
  if (error) throw new Error(error.message);
}

/** Comentários já saem agrupados: raiz na lista, respostas dentro de cada uma. */
export async function listComments(postId: string): Promise<PostComment[]> {
  const { data, error } = await supabase
    .from('post_comments')
    .select('id, post_id, parent_id, author_id, content, created_at, profiles(display_name, avatar_url)')
    .eq('post_id', postId)
    .order('created_at');

  if (error) throw new Error(error.message);

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const flat: PostComment[] = (data ?? []).map((row: any) => ({
    id: row.id,
    postId: row.post_id,
    parentId: row.parent_id ?? null,
    authorId: row.author_id,
    content: row.content,
    createdAt: row.created_at,
    authorName: row.profiles?.display_name ?? 'Estudante',
    authorAvatar: row.profiles?.avatar_url ?? null,
    replies: [],
  }));
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const byId = new Map(flat.map((comment) => [comment.id, comment]));
  const roots: PostComment[] = [];

  for (const comment of flat) {
    const parent = comment.parentId ? byId.get(comment.parentId) : undefined;
    if (parent) parent.replies.push(comment);
    else roots.push(comment);
  }

  return roots;
}

export async function addComment(postId: string, content: string, parentId?: string | null): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Você precisa estar logado.');

  const { error } = await supabase.from('post_comments').insert({
    post_id: postId,
    author_id: userId,
    parent_id: parentId ?? null,
    content: content.trim(),
  });

  if (error) throw new Error(error.message);
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase.from('post_comments').delete().eq('id', commentId);
  if (error) throw new Error(error.message);
}
