/**
 * Espelho do bitfield definido em supabase/migrations/0001_social_foundation.sql.
 * Serve só para a interface esconder o que o usuário não pode fazer — quem
 * garante de verdade é o RLS no Postgres. Mantenha os dois lados em sincronia.
 */
export const Permission = {
  VIEW_ROOM: 1,
  SEND_MESSAGES: 2,
  MANAGE_MESSAGES: 4,
  CREATE_POSTS: 8,
  MANAGE_POSTS: 16,
  UPLOAD_MATERIALS: 32,
  MANAGE_MATERIALS: 64,
  MANAGE_ROOMS: 128,
  MANAGE_ROLES: 256,
  KICK_MEMBERS: 512,
  MANAGE_GROUP: 1024,
  ADMINISTRATOR: 2048,
} as const;

export type PermissionKey = keyof typeof Permission;

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  VIEW_ROOM: 'Ver salas e ler mensagens',
  SEND_MESSAGES: 'Enviar mensagens',
  MANAGE_MESSAGES: 'Apagar mensagens de outros',
  CREATE_POSTS: 'Publicar no feed',
  MANAGE_POSTS: 'Apagar posts de outros',
  UPLOAD_MATERIALS: 'Enviar materiais',
  MANAGE_MATERIALS: 'Apagar materiais de outros',
  MANAGE_ROOMS: 'Gerenciar salas',
  MANAGE_ROLES: 'Gerenciar cargos',
  KICK_MEMBERS: 'Remover membros',
  MANAGE_GROUP: 'Editar grupo e mascote',
  ADMINISTRATOR: 'Administrador (tudo)',
};

/** A ordem em que os cargos são exibidos e editados. */
export const PERMISSION_ORDER: PermissionKey[] = [
  'VIEW_ROOM',
  'SEND_MESSAGES',
  'CREATE_POSTS',
  'UPLOAD_MATERIALS',
  'MANAGE_MESSAGES',
  'MANAGE_POSTS',
  'MANAGE_MATERIALS',
  'MANAGE_ROOMS',
  'MANAGE_ROLES',
  'KICK_MEMBERS',
  'MANAGE_GROUP',
  'ADMINISTRATOR',
];

export function hasPermission(permissions: number, bit: number, isOwner = false): boolean {
  if (isOwner) return true;
  if ((permissions & Permission.ADMINISTRATOR) !== 0) return true;
  return (permissions & bit) !== 0;
}

export function togglePermission(permissions: number, bit: number): number {
  return (permissions & bit) !== 0 ? permissions & ~bit : permissions | bit;
}
