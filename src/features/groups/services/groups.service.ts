import { supabase } from '@/services/supabase';
import { parseTheme, type GroupTheme } from '../theme';

export type Group = {
  id: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  bannerUrl: string | null;
  mascotName: string | null;
  mascotUrl: string | null;
  theme: GroupTheme;
  ownerId: string;
  joinCode: string;
  isPublic: boolean;
};

export type GroupRole = {
  id: string;
  groupId: string;
  name: string;
  color: string;
  permissions: number;
  position: number;
  isDefault: boolean;
};

export type GroupMember = {
  userId: string;
  groupId: string;
  roleId: string | null;
  nickname: string | null;
  displayName: string;
  avatarUrl: string | null;
  roleName: string | null;
  roleColor: string | null;
};

export type Room = {
  id: string;
  groupId: string;
  name: string;
  kind: 'chat' | 'feed' | 'materials';
  position: number;
};

const GROUP_COLUMNS =
  'id, name, description, icon_url, banner_url, mascot_name, mascot_url, theme, owner_id, join_code, is_public';

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapGroup(row: any): Group {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    iconUrl: row.icon_url,
    bannerUrl: row.banner_url ?? null,
    mascotName: row.mascot_name,
    mascotUrl: row.mascot_url,
    theme: parseTheme(row.theme),
    ownerId: row.owner_id,
    joinCode: row.join_code,
    isPublic: row.is_public,
  };
}

function mapRole(row: any): GroupRole {
  return {
    id: row.id,
    groupId: row.group_id,
    name: row.name,
    color: row.color,
    permissions: Number(row.permissions),
    position: row.position,
    isDefault: row.is_default,
  };
}

function mapRoom(row: any): Room {
  return { id: row.id, groupId: row.group_id, name: row.name, kind: row.kind, position: row.position };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function listMyGroups(): Promise<Group[]> {
  const { data, error } = await supabase
    .from('groups')
    .select(GROUP_COLUMNS)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapGroup);
}

export async function getGroup(groupId: string): Promise<Group | null> {
  const { data, error } = await supabase.from('groups').select(GROUP_COLUMNS).eq('id', groupId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapGroup(data) : null;
}

/**
 * Criar grupo passa pela função create_group.
 *
 * O INSERT direto criava dois grupos idênticos quando o botão era tocado duas
 * vezes (ou a requisição saía repetida). Travar o botão ajuda, mas a garantia
 * de verdade é no servidor: pedir o mesmo nome duas vezes numa janela de 15s
 * devolve o grupo que já foi criado, em vez de criar outro.
 */
export async function createGroup(name: string, description?: string): Promise<Group> {
  const { data: groupId, error } = await supabase.rpc('create_group', {
    p_name: name.trim(),
    p_description: description?.trim() || null,
  });

  if (error) throw new Error(error.message);

  const group = await getGroup(groupId as string);
  if (!group) throw new Error('Não foi possível abrir o grupo recém-criado.');
  return group;
}

export async function deleteGroup(groupId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_group', { p_group_id: groupId });
  if (error) throw new Error(error.message);
}

export async function updateGroup(
  groupId: string,
  patch: {
    name?: string;
    description?: string;
    iconUrl?: string;
    bannerUrl?: string;
    mascotName?: string;
    mascotUrl?: string;
    theme?: GroupTheme;
    isPublic?: boolean;
  }
): Promise<void> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) payload.name = patch.name.trim();
  if (patch.description !== undefined) payload.description = patch.description.trim() || null;
  if (patch.isPublic !== undefined) payload.is_public = patch.isPublic;
  if (patch.iconUrl !== undefined) payload.icon_url = patch.iconUrl;
  if (patch.bannerUrl !== undefined) payload.banner_url = patch.bannerUrl;
  if (patch.mascotName !== undefined) payload.mascot_name = patch.mascotName.trim() || null;
  if (patch.mascotUrl !== undefined) payload.mascot_url = patch.mascotUrl;
  if (patch.theme !== undefined) payload.theme = patch.theme;

  const { error } = await supabase.from('groups').update(payload).eq('id', groupId);
  // O gatilho no banco recusa recursos Pro para conta gratuita; a mensagem
  // vem com o prefixo PRO_REQUIRED e a interface traduz.
  if (error) throw new Error(error.message);
}

/**
 * Entrar em grupo passa pela função join_group no banco, não por queries
 * diretas. Motivo: a política de SELECT esconde grupos de quem não é membro
 * (então buscar pelo código aqui voltaria vazio), e permitir inserção direta em
 * group_members deixaria qualquer um entrar num grupo privado só sabendo o
 * UUID. A função valida o código no servidor e é o único caminho de entrada.
 */
export async function joinGroupByCode(joinCode: string): Promise<Group> {
  const { data: groupId, error } = await supabase.rpc('join_group', {
    p_join_code: joinCode.trim().toLowerCase(),
  });

  if (error) throw new Error(error.message);
  if (!groupId) throw new Error('Nenhum grupo encontrado com esse código.');

  // Agora que somos membros, a política de SELECT libera a leitura.
  const group = await getGroup(groupId as string);
  if (!group) throw new Error('Não foi possível abrir o grupo.');
  return group;
}

export async function leaveGroup(groupId: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Você precisa estar logado.');

  const { error } = await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export async function listRooms(groupId: string): Promise<Room[]> {
  const { data, error } = await supabase
    .from('rooms')
    .select('id, group_id, name, kind, position')
    .eq('group_id', groupId)
    .order('position');

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRoom);
}

export async function createRoom(groupId: string, name: string, kind: Room['kind'] = 'chat'): Promise<Room> {
  const { data, error } = await supabase
    .from('rooms')
    .insert({ group_id: groupId, name: name.trim(), kind })
    .select('id, group_id, name, kind, position')
    .single();

  if (error) throw new Error(error.message);
  return mapRoom(data);
}

export async function listRoles(groupId: string): Promise<GroupRole[]> {
  const { data, error } = await supabase
    .from('group_roles')
    .select('id, group_id, name, color, permissions, position, is_default')
    .eq('group_id', groupId)
    .order('position', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRole);
}

export async function createRole(groupId: string, name: string, permissions: number): Promise<GroupRole> {
  const { data, error } = await supabase
    .from('group_roles')
    .insert({ group_id: groupId, name: name.trim(), permissions })
    .select('id, group_id, name, color, permissions, position, is_default')
    .single();

  if (error) throw new Error(error.message);
  return mapRole(data);
}

export async function updateRolePermissions(roleId: string, permissions: number): Promise<void> {
  const { error } = await supabase.from('group_roles').update({ permissions }).eq('id', roleId);
  if (error) throw new Error(error.message);
}

export async function deleteRole(roleId: string): Promise<void> {
  const { error } = await supabase.from('group_roles').delete().eq('id', roleId);
  if (error) throw new Error(error.message);
}

export async function listMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('group_id, user_id, role_id, nickname, profiles(display_name, avatar_url), group_roles(name, color)')
    .eq('group_id', groupId);

  if (error) throw new Error(error.message);

  /* eslint-disable @typescript-eslint/no-explicit-any */
  return (data ?? []).map((row: any) => ({
    userId: row.user_id,
    groupId: row.group_id,
    roleId: row.role_id,
    nickname: row.nickname,
    displayName: row.profiles?.display_name ?? 'Estudante',
    avatarUrl: row.profiles?.avatar_url ?? null,
    roleName: row.group_roles?.name ?? null,
    roleColor: row.group_roles?.color ?? null,
  }));
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export async function assignRole(groupId: string, userId: string, roleId: string | null): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .update({ role_id: roleId })
    .eq('group_id', groupId)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
}

export async function kickMember(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);
  if (error) throw new Error(error.message);
}

/** Permissões acumuladas do usuário atual no grupo, para a interface se adaptar. */
export async function getMyPermissions(groupId: string): Promise<{ permissions: number; isOwner: boolean }> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { permissions: 0, isOwner: false };

  const { data: group } = await supabase.from('groups').select('owner_id').eq('id', groupId).maybeSingle();
  const isOwner = group?.owner_id === userId;

  const { data: membership } = await supabase
    .from('group_members')
    .select('group_roles(permissions)')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const permissions = Number((membership as any)?.group_roles?.permissions ?? 0);
  return { permissions, isOwner };
}
