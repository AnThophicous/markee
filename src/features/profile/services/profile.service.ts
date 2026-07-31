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
  /** Recado curto do momento: "estudando pra prova de bio". */
  statusText: string | null;
  statusEmoji: string | null;
  /** Quando o recado deixa de valer. Nulo = não expira. */
  statusUntil: string | null;
};

export type ProfilePatch = {
  displayName?: string;
  avatarUrl?: string;
  bannerUrl?: string | null;
  bio?: string;
  pronouns?: string;
  headline?: string;
  theme?: VisualTheme;
  statusText?: string | null;
  statusEmoji?: string | null;
  statusUntil?: string | null;
};

const COLUMNS =
  'id, display_name, avatar_url, banner_url, bio, pronouns, headline, profile_theme, friend_code, ' +
  'status_text, status_emoji, status_until';

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
    statusText: row.status_text ?? null,
    statusEmoji: row.status_emoji ?? null,
    statusUntil: row.status_until ?? null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * O status vale agora?
 *
 * Ninguém apaga status vencido no servidor — não existe tarefa periódica para
 * isso e não precisa existir. Quem lê é que compara com o horário atual. Um
 * status de "volto em 30 min" posto ontem simplesmente para de aparecer.
 */
export function statusAtivo(
  profile: Pick<Profile, 'statusText' | 'statusEmoji' | 'statusUntil'> | null | undefined
): { texto: string | null; emoji: string | null } | null {
  if (!profile) return null;
  if (!profile.statusText && !profile.statusEmoji) return null;

  if (profile.statusUntil) {
    const fim = Date.parse(profile.statusUntil);
    // Data ilegível conta como sem validade: some o recado por causa de um
    // problema de formato seria pior do que deixá-lo aparecer.
    if (Number.isFinite(fim) && fim <= Date.now()) return null;
  }

  return { texto: profile.statusText, emoji: profile.statusEmoji };
}

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

  // Vão como estão, inclusive nulos: nulo aqui quer dizer "tirar o status", e
  // trocar por `|| null` como nos campos acima confundiria "apagar" com "não
  // mexer". O gatilho no servidor é quem valida tamanho, emoji e validade.
  if (patch.statusText !== undefined) payload.status_text = patch.statusText;
  if (patch.statusEmoji !== undefined) payload.status_emoji = patch.statusEmoji;
  if (patch.statusUntil !== undefined) payload.status_until = patch.statusUntil;

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

/** O bucket recusa acima disto (0016). Conferir aqui é só para dar erro melhor. */
export const LIMITE_DE_IMAGEM = 8 * 1024 * 1024;

/**
 * O que o arquivo É, lido dos primeiros bytes — e não do que o nome promete.
 *
 * A extensão é palpite: o seletor do Android devolve caminhos como
 * `.../ImagePicker/abc123` sem extensão nenhuma, e um arquivo renomeado à mão
 * mente por completo. Enviar `image/gif` para um JPEG faz o navegador de quem
 * abrir a foto tratar bytes de um formato como se fossem de outro, e no melhor
 * caso a imagem simplesmente não aparece.
 *
 * Os quatro formatos são os que o bucket aceita. Devolve nulo para o resto, e o
 * envio para antes de sair do aparelho.
 */
export function formatoDaImagem(bytes: Uint8Array): { mime: string; extensao: string } | null {
  const b = bytes;
  if (b.length < 12) return null;

  // GIF87a / GIF89a
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return { mime: 'image/gif', extensao: 'gif' };
  // PNG: \x89PNG\r\n\x1a\n
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
    return { mime: 'image/png', extensao: 'png' };
  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', extensao: 'jpg' };
  // WEBP: "RIFF" .... "WEBP"
  if (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return { mime: 'image/webp', extensao: 'webp' };
  }

  return null;
}

/**
 * Um GIF é animado se tiver mais de um bloco de imagem.
 *
 * Serve para avisar antes de gastar o envio: um GIF de quadro único fica
 * parado na tela igualzinho a um JPEG, e a pessoa que acabou de assinar o Pro
 * para ter foto animada acharia que o recurso não funciona.
 *
 * A varredura é dos separadores de bloco (0x2C) depois do cabeçalho. Não é um
 * decodificador de GIF — não precisa ser: contar dois já responde a pergunta,
 * e errar para o lado de "achou que era animado" só faz o aviso não aparecer.
 */
export function gifEhAnimado(bytes: Uint8Array): boolean {
  let quadros = 0;
  for (let i = 0; i < bytes.length - 1; i += 1) {
    if (bytes[i] === 0x00 && bytes[i + 1] === 0x2c) {
      quadros += 1;
      if (quadros > 1) return true;
    }
  }
  return false;
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
  const bytes = new Uint8Array(arrayBuffer);

  if (bytes.byteLength > LIMITE_DE_IMAGEM) {
    throw new Error(
      `A imagem tem ${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB e o limite é 8 MB.`
    );
  }

  const formato = formatoDaImagem(bytes);
  if (!formato) throw new Error('Esse arquivo não é uma imagem que a gente aceita.');

  const filePath = `${userId}/${kind}-${Date.now()}.${formato.extensao}`;

  const { error } = await supabase.storage
    .from('avatars')
    .upload(filePath, arrayBuffer, { contentType: formato.mime, upsert: true });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
  return data.publicUrl;
}
