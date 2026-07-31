import { supabase } from '@/services/supabase';

/** userId -> códigos de emblema. */
export type EmblemasDoGrupo = Map<string, string[]>;

/**
 * A função ainda não existe no banco?
 *
 * O aplicativo é publicado antes da migração rodar, e enquanto os dois não se
 * encontram o PostgREST responde PGRST202 ("função não encontrada"). Tratar
 * isso como lista vazia é o que impede a lista de membros inteira de virar uma
 * tela de erro por causa de um enfeite.
 *
 * Só este código, e não qualquer erro: falha de rede ou de permissão precisa
 * continuar aparecendo, senão um defeito de verdade fica escondido para sempre
 * atrás de "esta pessoa não tem emblema".
 */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
const aindaNaoExiste = (erro: any): boolean =>
  erro?.code === 'PGRST202' || /schema cache|does not exist/i.test(erro?.message ?? '');

/**
 * Os emblemas de todo mundo do grupo, numa chamada.
 *
 * Uma por grupo, e não uma por membro: a lista desenha todos na mesma tela, e
 * pedir de um em um seria uma rajada de requisições toda vez que a aba abrisse.
 *
 * O servidor recusa se quem pergunta não for do grupo. Não há nada a conferir
 * aqui — e nem daria: conferência de permissão no cliente é enfeite, porque
 * basta chamar a API direto para pular por cima dela.
 */
export async function carregarEmblemasDoGrupo(groupId: string): Promise<EmblemasDoGrupo> {
  const { data, error } = await supabase.rpc('emblemas_do_grupo', { p_group: groupId });
  if (error) {
    if (aindaNaoExiste(error)) return new Map();
    throw new Error(error.message);
  }

  const mapa: EmblemasDoGrupo = new Map();
  for (const linha of (data ?? []) as { user_id: string; emblema: string }[]) {
    const atuais = mapa.get(linha.user_id);
    if (atuais) atuais.push(linha.emblema);
    else mapa.set(linha.user_id, [linha.emblema]);
  }
  return mapa;
}

/** Os que a pessoa carrega para qualquer lugar, para o perfil público. */
export async function carregarEmblemasDoPerfil(userId: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('emblemas_do_perfil', { p_user: userId });
  if (error) {
    if (aindaNaoExiste(error)) return [];
    throw new Error(error.message);
  }
  return ((data ?? []) as { emblema: string }[]).map((linha) => linha.emblema);
}
