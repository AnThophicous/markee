import { supabase } from '@/services/supabase';

export type ChatMessage = {
  id: string;
  roomId: string;
  authorId: string;
  content: string;
  createdAt: string;
  authorName: string;
  authorAvatar: string | null;
};

const PAGE_SIZE = 50;

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapMessage(row: any): ChatMessage {
  return {
    id: row.id,
    roomId: row.room_id,
    authorId: row.author_id,
    content: row.content,
    createdAt: row.created_at,
    authorName: row.profiles?.display_name ?? 'Estudante',
    authorAvatar: row.profiles?.avatar_url ?? null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Busca as últimas PAGE_SIZE mensagens (por isso a ordem decrescente no SQL) e
 * devolve em ordem cronológica, que é como a FlashList v2 espera — ela renderiza
 * a partir do fim em vez de usar lista invertida.
 */
export async function listMessages(roomId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, room_id, author_id, content, created_at, profiles(display_name, avatar_url)')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapMessage).reverse();
}

export async function sendMessage(roomId: string, content: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Você precisa estar logado.');

  const { error } = await supabase
    .from('messages')
    .insert({ room_id: roomId, author_id: userId, content: content.trim() });

  if (error) {
    // O RLS recusa quando falta SEND_MESSAGES; traduzimos para algo legível.
    if (error.message.toLowerCase().includes('row-level security')) {
      throw new Error('Você não tem permissão para enviar mensagens nesta sala.');
    }
    throw new Error(error.message);
  }
}

export async function deleteMessage(messageId: string): Promise<void> {
  const { error } = await supabase.from('messages').delete().eq('id', messageId);
  if (error) throw new Error(error.message);
}

/**
 * O payload do realtime traz só a linha crua de `messages`, sem o join do
 * perfil — por isso buscamos o autor separado antes de entregar a mensagem.
 */
export function subscribeToRoom(roomId: string, onMessage: (message: ChatMessage) => void) {
  const channel = supabase
    .channel(`room:${roomId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
      async (payload) => {
        const row = payload.new as Record<string, unknown>;
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, avatar_url')
          .eq('id', row.author_id as string)
          .maybeSingle();

        onMessage(mapMessage({ ...row, profiles: profile }));
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
