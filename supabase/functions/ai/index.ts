/**
 * Proxy de IA do Markee.
 *
 * Existe para a cota fazer sentido. Sem ele, o app chama a OpenRouter direto
 * com a chave do próprio usuário — e aí cobrar por "500 pedidos" seria cobrar
 * para LIMITAR uma chave que a pessoa já paga. Não custa processamento nosso,
 * então não há o que cobrar.
 *
 * Com este proxy a conta muda: a chave é nossa, os tokens saem do nosso bolso,
 * e aí sim o plano gratuito dá 20 pedidos por mês e o Pro dá 500.
 *
 * Regras que só podem morar aqui, nunca no aplicativo:
 *   - a chave da OpenRouter (se fosse para o app, sairia no primeiro APK aberto);
 *   - o débito da cota, feito ANTES da chamada, com trava de linha no Postgres.
 *
 * Publicar:
 *   supabase secrets set OPENROUTER_API_KEY=sk-or-v1-...
 *   supabase functions deploy ai
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const FREE_MODEL = 'openrouter/free';
const MAX_TOKENS = 2000;
const MAX_PROMPT_CHARS = 24_000;

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

  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!apiKey) return json({ error: 'IA não configurada no servidor.' }, 503);

  // O token de quem chamou é repassado ao supabase-js, então auth.uid() dentro
  // do Postgres é a pessoa de verdade — e não dá para debitar a cota de outra.
  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ error: 'Você precisa estar logado.' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authorization } } }
  );

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return json({ error: 'Sessão inválida.' }, 401);

  let payload: { system?: string; prompt?: string; maxTokens?: number };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Pedido malformado.' }, 400);
  }

  const prompt = (payload.prompt ?? '').trim();
  if (!prompt) return json({ error: 'Nada para processar.' }, 400);
  if (prompt.length > MAX_PROMPT_CHARS) {
    return json({ error: 'Texto longo demais para uma chamada só.' }, 413);
  }

  /**
   * Debita ANTES de chamar a OpenRouter. Debitar depois deixaria a porta aberta
   * para gastar de graça: bastava fechar o app enquanto a resposta vem.
   * consume_quota usa trava de linha, então dois pedidos ao mesmo tempo não
   * passam ambos pela última unidade.
   */
  const { error: quotaError } = await supabase.rpc('consume_quota', {
    p_kind: 'ai_call',
    p_amount: 1,
  });

  if (quotaError) {
    const exceeded = quotaError.message.includes('QUOTA_EXCEEDED');
    return json({ error: quotaError.message }, exceeded ? 429 : 400);
  }

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Title': 'Markee',
    },
    body: JSON.stringify({
      model: FREE_MODEL,
      messages: [
        ...(payload.system ? [{ role: 'system', content: payload.system }] : []),
        { role: 'user', content: prompt },
      ],
      max_tokens: Math.min(payload.maxTokens ?? 1200, MAX_TOKENS),
    }),
  });

  if (!response.ok) {
    return json({ error: 'A IA não respondeu. Tente de novo.' }, 502);
  }

  const body = await response.json();
  const content = body?.choices?.[0]?.message?.content;

  if (!content || !String(content).trim()) {
    // O roteador gratuito às vezes cai num modelo que não devolve texto. A cota
    // já foi debitada; devolver 502 deixa o app tentar de novo, e o retry é o
    // comportamento certo aqui.
    return json({ error: 'A IA não retornou uma resposta. Tente novamente.' }, 502);
  }

  return json({ content: String(content).trim() });
});
