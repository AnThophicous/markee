import { supabase } from '@/services/supabase';

export type GroupEvent = {
  id: string;
  groupId: string;
  title: string;
  description: string | null;
  startsAt: string;
  createdBy: string;
  authorName: string;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapEvent(row: any): GroupEvent {
  return {
    id: row.id,
    groupId: row.group_id,
    title: row.title,
    description: row.description,
    startsAt: row.starts_at,
    createdBy: row.created_by,
    authorName: row.profiles?.display_name ?? 'Estudante',
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Agenda do grupo: prova, entrega, sessão de estudo. Só o que ainda vai acontecer. */
export async function listEvents(groupId: string): Promise<GroupEvent[]> {
  const { data, error } = await supabase
    .from('group_events')
    .select('id, group_id, title, description, starts_at, created_by, profiles(display_name)')
    .eq('group_id', groupId)
    .gte('starts_at', new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
    .order('starts_at')
    .limit(30);

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapEvent);
}

export async function createEvent(
  groupId: string,
  input: { title: string; description?: string; startsAt: Date }
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Você precisa estar logado.');

  const { error } = await supabase.from('group_events').insert({
    group_id: groupId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    starts_at: input.startsAt.toISOString(),
    created_by: userId,
  });

  if (error) throw new Error(error.message);
}

export async function deleteEvent(eventId: string): Promise<void> {
  const { error } = await supabase.from('group_events').delete().eq('id', eventId);
  if (error) throw new Error(error.message);
}
