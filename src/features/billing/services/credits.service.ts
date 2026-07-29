import { supabase } from '@/services/supabase';

import type { LinhaDoExtrato } from '../creditos';

/**
 * Saldo, extrato e pacotes — tudo só de leitura.
 *
 * Não existe função aqui que aumente saldo, e a ausência é o ponto. Crédito só
 * entra pela `grant_credits`, que o servidor chama depois de ouvir a loja, e
 * que NÃO tem permissão concedida para `authenticated`. Um APK modificado que
 * chame tudo o que este arquivo exporta continua sem conseguir se dar um
 * crédito — porque o banco recusa, não porque o aplicativo se comporta.
 */

export type Saldo = {
  creditos: number;
  /** Quanto vale um crédito em dólar, para conferência. */
  unidadeUsd: number;
};

export async function lerSaldo(): Promise<Saldo> {
  const { data, error } = await supabase.rpc('my_credits');
  if (error) throw new Error(error.message);

  const linha = Array.isArray(data) ? data[0] : data;
  return {
    creditos: Number(linha?.saldo ?? 0),
    unidadeUsd: Number(linha?.unidade_usd ?? 0),
  };
}

/**
 * O extrato.
 *
 * A política de RLS já devolve só as linhas de quem está logado — o filtro por
 * usuário não é escrito aqui de propósito. Repetir a regra no cliente dá a
 * impressão de que ela mora no cliente, e alguém depois "simplifica" o servidor
 * confiando nesse filtro.
 */
export async function lerExtrato(limite = 100): Promise<LinhaDoExtrato[]> {
  const { data, error } = await supabase
    .from('credit_ledger')
    .select('id, delta, motivo, created_at')
    .order('created_at', { ascending: false })
    .limit(limite);

  if (error) throw new Error(error.message);

  return (data ?? []).map((l) => ({
    id: Number(l.id),
    delta: Number(l.delta),
    motivo: String(l.motivo),
    quando: new Date(String(l.created_at)).getTime(),
  }));
}

export type Pacote = {
  id: string;
  nome: string;
  creditos: number;
  centavos: number;
  posicao: number;
};

export async function listarPacotes(): Promise<Pacote[]> {
  const { data, error } = await supabase
    .from('credit_packs')
    .select('id, name, credits, price_cents, position')
    .eq('active', true)
    .order('position');

  if (error) throw new Error(error.message);

  return (data ?? []).map((p) => ({
    id: String(p.id),
    nome: String(p.name),
    creditos: Number(p.credits),
    centavos: Number(p.price_cents),
    posicao: Number(p.position),
  }));
}
