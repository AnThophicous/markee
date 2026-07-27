import { getPublicKey, open, seal } from '@/features/crypto/e2e';
import { supabase } from '@/services/supabase';
import { parseTheme, type VisualTheme } from '@/theme/visual';

export type FriendStatus = 'accepted' | 'incoming' | 'outgoing';

export type Friend = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  headline: string | null;
  theme: VisualTheme;
  status: FriendStatus;
};

export type DmMessage = {
  id: string;
  threadId: string;
  authorId: string;
  content: string;
  createdAt: string;
  authorName: string;
  authorAvatar: string | null;
  /** Chegou cifrada do servidor. */
  encrypted: boolean;
  /** Cifrada mas não abriu — chave trocada ou aparelho novo. */
  unreadable: boolean;
};

/**
 * A lista vem em duas consultas porque `my_friendships` é uma view sobre uma
 * tabela cujas duas colunas apontam para perfis; o PostgREST não consegue
 * embutir o perfil "do outro lado" a partir dela. Buscar os perfis num
 * `in (...)` custa uma ida a mais e mantém a view simples.
 */
export async function listFriends(): Promise<Friend[]> {
  const { data: links, error } = await supabase
    .from('my_friendships')
    .select('friend_id, status, sent_by_me');

  if (error) throw new Error(error.message);
  if (!links || links.length === 0) return [];

  const ids = links.map((link) => link.friend_id as string);
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, headline, profile_theme')
    .in('id', ids);

  if (profileError) throw new Error(profileError.message);

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const byId = new Map((profiles ?? []).map((profile: any) => [profile.id, profile]));

  return links.map((link: any) => {
    const profile = byId.get(link.friend_id);
    return {
      userId: link.friend_id,
      displayName: profile?.display_name ?? 'Estudante',
      avatarUrl: profile?.avatar_url ?? null,
      headline: profile?.headline ?? null,
      theme: parseTheme(profile?.profile_theme),
      status:
        link.status === 'accepted' ? 'accepted' : link.sent_by_me ? 'outgoing' : 'incoming',
    };
  });
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export async function sendFriendRequest(friendCode: string): Promise<string> {
  const { data, error } = await supabase.rpc('send_friend_request', { p_friend_code: friendCode });
  if (error) throw new Error(translate(error.message));
  return data as string;
}

export async function acceptFriendRequest(userId: string): Promise<void> {
  const { error } = await supabase.rpc('accept_friend_request', { p_user: userId });
  if (error) throw new Error(translate(error.message));
}

export async function removeFriend(userId: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const me = userData.user?.id;
  if (!me) throw new Error('Você precisa estar logado.');

  // A linha é canônica (menor uuid primeiro), então os dois lados apagam a mesma.
  const [a, b] = me < userId ? [me, userId] : [userId, me];
  const { error } = await supabase.from('friendships').delete().eq('user_a', a).eq('user_b', b);
  if (error) throw new Error(error.message);
}

/**
 * Publica a chave pública deste aparelho, se ainda não for a que está no
 * servidor. Chamado ao abrir o app: sem isso ninguém consegue cifrar para nós.
 */
export async function publishPublicKey(): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return;

  const mine = getPublicKey();
  const { data } = await supabase.from('profiles').select('public_key').eq('id', userId).maybeSingle();
  if (data?.public_key === mine) return;

  const { error } = await supabase.rpc('set_public_key', { p_key: mine });
  if (error) throw new Error(error.message);
}

/** Chave pública do outro lado — é com ela que a mensagem é cifrada. */
export async function getPeerKey(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from('profiles').select('public_key').eq('id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.public_key ?? null;
}

/** Quem é a outra pessoa da conversa, e a chave pública dela. */
export async function getThreadPeer(threadId: string): Promise<{ userId: string; publicKey: string | null } | null> {
  const { data: userData } = await supabase.auth.getUser();
  const me = userData.user?.id;
  if (!me) return null;

  const { data, error } = await supabase
    .from('dm_threads')
    .select('user_a, user_b')
    .eq('id', threadId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const peerId = data.user_a === me ? data.user_b : data.user_a;
  return { userId: peerId, publicKey: await getPeerKey(peerId) };
}

export async function regenerateFriendCode(): Promise<string> {
  const { data, error } = await supabase.rpc('regenerate_friend_code');
  if (error) throw new Error(error.message);
  return data as string;
}

export async function openDm(userId: string): Promise<string> {
  const { data, error } = await supabase.rpc('open_dm', { p_user: userId });
  if (error) throw new Error(translate(error.message));
  return data as string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Decifra se vier cifrada; texto antigo (antes da cripto) passa direto. */
function decodeRow(row: any, peerKey: string | null): DmMessage {
  const base = {
    id: row.id,
    threadId: row.thread_id,
    authorId: row.author_id,
    createdAt: row.created_at,
    authorName: row.profiles?.display_name ?? 'Estudante',
    authorAvatar: row.profiles?.avatar_url ?? null,
    encrypted: Boolean(row.encrypted),
  };

  if (!row.encrypted) {
    return { ...base, content: row.content, unreadable: false };
  }

  const plain = peerKey ? open({ ciphertext: row.content, nonce: row.nonce }, peerKey) : null;
  return plain === null
    ? { ...base, content: '', unreadable: true }
    : { ...base, content: plain, unreadable: false };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function listDmMessages(threadId: string): Promise<DmMessage[]> {
  const peer = await getThreadPeer(threadId);

  const { data, error } = await supabase
    .from('dm_messages')
    .select('id, thread_id, author_id, content, nonce, encrypted, created_at, profiles(display_name, avatar_url)')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })
    .limit(60);

  if (error) throw new Error(error.message);

  // A consulta vem do mais novo para o mais antigo (para o limite pegar as
  // últimas), e a lista é invertida aqui porque a tela mostra em ordem.
  return (data ?? []).map((row) => decodeRow(row, peer?.publicKey ?? null)).reverse();
}

export async function sendDmMessage(threadId: string, content: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Você precisa estar logado.');

  const peer = await getThreadPeer(threadId);
  const text = content.trim();

  /**
   * Sem a chave do outro lado não dá para cifrar. Em vez de mandar em texto
   * puro escondido, a mensagem não sai e a pessoa é avisada — prometer sigilo e
   * não entregar seria pior do que não ter sigilo.
   */
  if (!peer?.publicKey) {
    throw new Error('A outra pessoa ainda não abriu o app nesta versão. Assim que ela abrir, a conversa fica cifrada.');
  }

  const sealed = seal(text, peer.publicKey);

  const { error } = await supabase.from('dm_messages').insert({
    thread_id: threadId,
    author_id: userId,
    content: sealed.ciphertext,
    nonce: sealed.nonce,
    encrypted: true,
  });

  if (error) throw new Error(error.message);
}

/** As funções do banco já respondem em português; isto cobre o resto. */
function translate(message: string): string {
  if (message.includes('duplicate key')) return 'Vocês já têm um pedido em aberto.';
  if (message.toLowerCase().includes('row-level security')) return 'Você não tem permissão para isso.';
  return message;
}

/** Mensagens novas da conversa chegam ao vivo, no mesmo molde das salas. */
export function subscribeToDm(threadId: string, onMessage: (message: DmMessage) => void) {
  const channel = supabase
    .channel(`dm:${threadId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'dm_messages', filter: `thread_id=eq.${threadId}` },
      async (payload) => {
        const row = payload.new as Record<string, unknown>;
        const [{ data: profile }, peer] = await Promise.all([
          supabase.from('profiles').select('display_name, avatar_url').eq('id', row.author_id as string).maybeSingle(),
          getThreadPeer(threadId),
        ]);

        onMessage(decodeRow({ ...row, profiles: profile }, peer?.publicKey ?? null));
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
