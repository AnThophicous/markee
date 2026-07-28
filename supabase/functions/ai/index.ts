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

/**
 * Usado só se o banco não devolver nenhum modelo — situação que não deveria
 * acontecer, mas que sem reserva viraria "a IA parou de funcionar" em vez de
 * "a IA respondeu com o modelo básico".
 */
const MODELO_RESERVA = 'openai/gpt-4o-mini';
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

  let payload: { system?: string; prompt?: string; maxTokens?: number; modelo?: string };
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
   * Qual modelo, e se pode.
   *
   * A escolha do app é uma SUGESTÃO: ela só vale se o modelo existir, estiver
   * ativo e o plano da pessoa alcançar o piso dele. Um APK modificado pedindo o
   * modelo caro numa conta grátis cai na verificação abaixo e recebe o que o
   * plano dela permite — não um erro, porque a pessoa não fez nada de errado se
   * a interface dela estiver desatualizada.
   */
  const { data: permitidos } = await supabase.rpc('my_ai_models');
  const lista = Array.isArray(permitidos) ? permitidos : [];

  const escolhido =
    lista.find((m: { id: string }) => m.id === payload.modelo) ?? lista[0] ?? null;
  const modelo = escolhido?.id ?? MODELO_RESERVA;

  /**
   * Saldo conferido ANTES, débito DEPOIS, pelos tokens que a chamada gastou de
   * verdade. Debitar um valor fixo antes cobraria igual de um resumo de duas
   * linhas e de um de duas páginas — e o custo entre os dois difere dez vezes.
   *
   * Quem está com saldo baixo consegue passar UMA chamada além. É limitado por
   * desenho: a chamada seguinte encontra o saldo zerado e para.
   */
  const { data: creditoRows } = await supabase.rpc('my_credits');
  const saldo = Number((Array.isArray(creditoRows) ? creditoRows[0] : creditoRows)?.saldo ?? 0);

  if (saldo <= 0) {
    return json({ error: `NO_CREDITS:${saldo}:1`, saldo }, 402);
  }

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Title': 'Markee',
    },
    body: JSON.stringify({
      model: modelo,
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
    // Nada foi debitado ainda — o débito vem depois desta guarda —, então
    // tentar de novo não custa crédito à pessoa. É o comportamento certo: ela
    // não recebeu nada.
    return json({ error: 'A IA não retornou uma resposta. Tente novamente.' }, 502);
  }

  /**
   * Tokens MEDIDOS, que a OpenRouter devolve em `usage`. Nunca estimados: uma
   * estimativa para menos é prejuízo silencioso, e para mais cobra pelo que não
   * aconteceu — e em nenhum dos dois casos a pessoa tem como conferir.
   *
   * Sem `usage` na resposta, não debita. Cobrar por um número inventado é pior
   * do que deixar uma chamada passar sem cobrança, e isso aparece no registro.
   */
  const entrada = Number(body?.usage?.prompt_tokens);
  const saida = Number(body?.usage?.completion_tokens);

  let creditos = 0;
  if (Number.isFinite(entrada) && Number.isFinite(saida)) {
    const { data: custoUsd } = await supabase.rpc('ai_call_cost_usd', {
      p_model: modelo,
      p_in: Math.round(entrada),
      p_out: Math.round(saida),
    });

    if (Number(custoUsd) > 0) {
      const { data: debitados, error: creditoErro } = await supabase.rpc('consume_credits', {
        p_custo_usd: Number(custoUsd),
        p_motivo: 'ia',
        p_ref: null,
      });
      if (creditoErro) console.error('falha ao debitar creditos de ia', creditoErro.message);
      else creditos = Number(debitados ?? 0);
    }
  } else {
    console.error('openrouter nao devolveu usage; chamada nao debitada', modelo);
  }

  return json({
    content: String(content).trim(),
    modelo,
    creditos,
    saldo: saldo - creditos,
  });
});
