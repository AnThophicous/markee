import { supabase } from '@/services/supabase';
import { storage } from '@/storage/mmkv';

import type { Afiliado } from '../afiliado';

const PENDENTE = 'afiliado.pendente';

/**
 * O código que chegou antes da conta existir.
 *
 * Quem toca num link de afiliado sem ter conta é mandado para o cadastro, e o
 * código se perderia no caminho — justo no caso mais comum do programa, que é
 * alguém chamando um amigo que ainda não usa o app. Guardado aqui, ele é
 * aplicado assim que a sessão aparece.
 *
 * Fica em MMKV e não em memória porque o cadastro passa pelo navegador (Google)
 * e o app pode ser reiniciado pelo sistema no meio.
 */
export const guardarCodigoPendente = (codigo: string) => storage.set(PENDENTE, codigo);
export const lerCodigoPendente = (): string | null => storage.getString(PENDENTE) ?? null;
export const esquecerCodigoPendente = () => storage.remove(PENDENTE);

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapear(row: any): Afiliado {
  return {
    codigo: row?.codigo ?? '',
    indicados: row?.indicados ?? 0,
    assinantes: row?.assinantes ?? 0,
    totalCents: row?.total_cents ?? 0,
    abertoCents: row?.aberto_cents ?? 0,
    minimoCents: row?.minimo_cents ?? 0,
    primeiraPct: Number(row?.primeira_pct ?? 0),
    recorrentePct: Number(row?.recorrente_pct ?? 0),
    janelaDias: row?.janela_dias ?? 0,
    fuiIndicado: Boolean(row?.fui_indicado),
    porCredito: Number(row?.por_credito ?? 0),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * O programa ainda não existe no banco?
 *
 * Enquanto a migração 0028 não roda, o PostgREST responde PGRST202. A tela de
 * afiliados mostra o estado "indisponível" em vez de uma mensagem de erro do
 * Postgres — e, principalmente, o link de indicação não aparece prometendo uma
 * comissão que o servidor ainda não sabe pagar.
 */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
const aindaNaoExiste = (erro: any): boolean =>
  erro?.code === 'PGRST202' || /schema cache|does not exist/i.test(erro?.message ?? '');

export async function carregarAfiliado(): Promise<Afiliado | null> {
  const { data, error } = await supabase.rpc('meu_afiliado');
  if (error) {
    if (aindaNaoExiste(error)) return null;
    throw new Error(error.message);
  }
  return mapear(data);
}

/**
 * "Fui indicado por este código."
 *
 * O servidor recusa se a conta já tiver indicação, se for antiga demais, ou se
 * o código for o da própria pessoa. Nada disso é conferido aqui: conferência no
 * cliente seria só para dar erro mais rápido, e o custo é ter a mesma regra
 * escrita em dois lugares para envelhecerem separadas.
 */
export async function registrarIndicacao(codigo: string): Promise<string> {
  const { data, error } = await supabase.rpc('set_referrer', { p_code: codigo });
  if (error) throw new Error(error.message);
  return (data as { nome?: string })?.nome ?? 'alguém';
}

export async function resgatarComissao(): Promise<{ centavos: number; creditos: number }> {
  const { data, error } = await supabase.rpc('resgatar_comissao');
  if (error) throw new Error(error.message);
  return data as { centavos: number; creditos: number };
}

// O `useSession` vive em muitas telas ao mesmo tempo, e todas veem a sessão
// aparecer no mesmo instante. Sem esta tranca, cada uma dispararia a sua
// chamada antes de qualquer outra apagar o código guardado — uma indicação
// única viraria meia dúzia de requisições ao servidor.
let aplicando = false;

/**
 * Aplica o código que ficou guardado, se houver.
 *
 * Esquece o código em QUALQUER desfecho, inclusive no erro. Um código que não
 * colou não vai colar depois — a conta já tem dono ou já passou da janela —, e
 * mantê-lo faria a tentativa se repetir a cada abertura do app para sempre.
 */
export async function aplicarPendente(): Promise<string | null> {
  if (aplicando) return null;
  const codigo = lerCodigoPendente();
  if (!codigo) return null;

  aplicando = true;
  try {
    return await registrarIndicacao(codigo);
  } catch {
    return null;
  } finally {
    esquecerCodigoPendente();
    aplicando = false;
  }
}
