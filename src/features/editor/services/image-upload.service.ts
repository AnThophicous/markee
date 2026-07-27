import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/services/supabase';

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Único caminho para imagem entrar numa nota. Sobe para o nosso bucket e
 * devolve a URL pública dele — o renderizador só exibe imagens dessa origem,
 * então colar link de fora nunca dispara requisição do aparelho.
 */
export async function pickAndUploadImage(): Promise<{ url: string; alt: string } | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Precisamos de acesso às suas fotos para inserir imagens.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
  });
  if (result.canceled) return null;

  const asset = result.assets[0];

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) {
    throw new Error('Entre na sua conta para anexar imagens.');
  }

  const response = await fetch(asset.uri);
  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_BYTES) {
    throw new Error('Imagem muito grande (máximo 8 MB).');
  }

  const extension = asset.uri.split('.').pop()?.toLowerCase().split('?')[0] ?? 'jpg';
  const contentType = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
  const filePath = `${userId}/notes/${Date.now()}.${extension}`;

  const { error } = await supabase.storage
    .from('uploads')
    .upload(filePath, arrayBuffer, { contentType, upsert: false });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from('uploads').getPublicUrl(filePath);
  return { url: data.publicUrl, alt: asset.fileName ?? 'Imagem' };
}
