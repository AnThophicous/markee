/**
 * Busca na web para a IA do Markee.
 *
 * Separada da função `ai` de propósito: buscar não gasta token, então não
 * debita cota. O que ela consome é tempo de rede, e por isso tem limite de
 * tamanho da consulta e exige sessão — para não virar um proxy de busca aberto
 * para qualquer um na internet.
 *
 * Publicar:
 *   supabase functions deploy search
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

import { formatResults, search } from '../_shared/duckduckgo.ts';

const MAX_QUERY_CHARS = 200;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ error: 'Você precisa estar logado.' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authorization } } }
  );

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return json({ error: 'Sessão inválida.' }, 401);

  let payload: { query?: string };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Pedido malformado.' }, 400);
  }

  const query = (payload.query ?? '').trim().slice(0, MAX_QUERY_CHARS);
  if (!query) return json({ error: 'Sem termo de busca.' }, 400);

  const results = await search(query);
  return json({ content: formatResults(query, results), results });
});
