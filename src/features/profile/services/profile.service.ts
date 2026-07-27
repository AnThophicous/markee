import { supabase } from '@/services/supabase';
import { parseTheme, type VisualTheme } from '@/theme/visual';

export type Profile = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  pronouns: string | null;
  headline: string | null;
  theme: VisualTheme;
  /** Código curto que vira QR — é ele que circula, nunca o id da conta. */
  friendCode: string;
};

export type ProfilePatch = {
  displayName?: string;
  avatarUrl?: string;
  bannerUrl?: string | null;
  bio?: string;
  pronouns?: string;
  headline?: string;
  theme?: VisualTheme;
};

const COLUMNS =
  'id, display_name, avatar_url, banner_url, bio, pronouns, headline, profile_theme, friend_code';

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapProfile(row: any): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    bannerUrl: row.banner_url ?? null,
    bio: row.bio,
    pronouns: row.pronouns ?? null,
    headline: row.headline ?? null,
    theme: parseTheme(row.profile_theme),
    friendCode: row.friend_code ?? '',
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getProfile(userId: string): Promise<Profile | null> {
  // Um id que não é UUID faz o Postgres devolver erro de sintaxe, e a tela
  // mostraria uma mensagem técnica em vez de "perfil não encontrado".
  if (!UUID.test(userId)) return null;

  const { data, error } = await supabase.from('profiles').select(COLUMNS).eq('id', userId).maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapProfile(data) : null;
}

export async function updateProfile(userId: string, patch: ProfilePatch): Promise<Profile> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.displayName !== undefined) payload.display_name = patch.displayName.trim();
  if (patch.avatarUrl !== undefined) payload.avatar_url = patch.avatarUrl;
  if (patch.bannerUrl !== undefined) payload.banner_url = patch.bannerUrl;
  if (patch.bio !== undefined) payload.bio = patch.bio.trim() || null;
  if (patch.pronouns !== undefined) payload.pronouns = patch.pronouns.trim() || null;
  if (patch.headline !== undefined) payload.headline = patch.headline.trim() || null;
  if (patch.theme !== undefined) payload.profile_theme = patch.theme;

  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId)
    .select(COLUMNS)
    .single();

  // Recursos Pro são recusados pelo gatilho com o prefixo PRO_REQUIRED; a
  // interface traduz com describeProError.
  if (error) throw new Error(error.message);
  return mapProfile(data);
}

/**
 * O bucket é público, então guardamos a URL pública. O caminho leva o id do
 * usuário para evitar colisão, e um timestamp para furar o cache da CDN quando
 * a foto é trocada.
 */
export async function uploadProfileImage(
  userId: string,
  kind: 'avatar' | 'banner',
  localUri: string
): Promise<string> {
  const response = await fetch(localUri);
  const arrayBuffer = await response.arrayBuffer();

  const extension = localUri.split('.').pop()?.toLowerCase().split('?')[0] ?? 'jpg';
  const contentType =
    extension === 'png' ? 'image/png' : extension === 'gif' ? 'image/gif' : 'image/jpeg';
  const filePath = `${userId}/${kind}-${Date.now()}.${extension}`;

  const { error } = await supabase.storage
    .from('avatars')
    .upload(filePath, arrayBuffer, { contentType, upsert: true });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
  return data.publicUrl;
}
