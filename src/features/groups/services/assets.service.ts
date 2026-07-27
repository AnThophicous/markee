import { supabase } from '@/services/supabase';

/**
 * Ícones, mascotes e banners vão para o bucket público `group-assets`. O caminho leva o
 * id do grupo e um timestamp, para não colidir e para furar o cache da CDN
 * quando a imagem é trocada.
 */
export async function uploadGroupAsset(
  groupId: string,
  kind: 'icon' | 'mascot' | 'banner',
  localUri: string
): Promise<string> {
  const response = await fetch(localUri);
  const arrayBuffer = await response.arrayBuffer();

  const extension = localUri.split('.').pop()?.toLowerCase().split('?')[0] ?? 'jpg';
  const contentType =
    extension === 'png' ? 'image/png' : extension === 'gif' ? 'image/gif' : 'image/jpeg';
  const filePath = `${groupId}/${kind}-${Date.now()}.${extension}`;

  const { error } = await supabase.storage
    .from('group-assets')
    .upload(filePath, arrayBuffer, { contentType, upsert: true });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from('group-assets').getPublicUrl(filePath);
  return data.publicUrl;
}
