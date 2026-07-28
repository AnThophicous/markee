/**
 * Transcrição de aula do Markee.
 *
 * O áudio chega aqui, e não vai direto do aparelho para a OpenAI, por três
 * motivos — nenhum deles resolvível no aplicativo:
 *
 *   1. A CHAVE. Uma chave de API dentro do APK sai no primeiro `unzip`. Já foi
 *      provado neste projeto que `EXPO_PUBLIC_*` vira literal no pacote.
 *
 *   2. O MODELO. O plano escolhe qual modelo usar, aqui dentro. Se o app
 *      mandasse o nome do modelo, um APK modificado pediria o caro numa conta
 *      grátis — e a diferença sairia do bolso de quem é dono da chave.
 *
 *   3. A COTA. Debitar no cliente seria decoração: bastaria chamar esta função
 *      direto, ou a da OpenAI.
 *
 * SEGMENTOS. A função de borda tem 150s de parede no plano grátis do Supabase
 * (400s no pago), e uma aula de 50 minutos não cabe numa chamada só. Por isso o
 * app grava em pedaços de poucos minutos e manda um por vez: cada chamada leva
 * segundos, o progresso aparece pedaço a pedaço, e um erro de rede refaz só o
 * pedaço que falhou em vez da aula inteira.
 *
 * Publicar:
 *   supabase secrets set OPENAI_API_KEY=sk-...
 *   supabase functions deploy transcrever
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const OPENAI_URL = 'https://api.openai.com/v1/audio/transcriptions';

/**
 * Teto do arquivo. A OpenAI recusa acima de 25 MB, mas o nosso corte é bem
 * antes: um segmento nosso é de poucos minutos, e gravação de voz em mono a
 * 32 kbps dá cerca de 240 KB por minuto. 12 MB é folga larga para o maior
 * segmento que o app produz, e ainda barra alguém tentando empurrar um filme.
 */
const MAX_BYTES = 12 * 1024 * 1024;

/** Formatos que a OpenAI aceita. Fora disto a chamada falharia lá, cobrando. */
const FORMATOS = new Set([
  'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a', 'audio/x-m4a',
  'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/ogg', 'video/mp4',
]);

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

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return json({ error: 'Transcrição não configurada no servidor.' }, 503);

  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ error: 'Você precisa estar logado.' }, 401);

  // O token de quem chamou vai junto, então `auth.uid()` dentro do Postgres é a
  // pessoa de verdade — não dá para consumir a cota de outra conta.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authorization } } }
  );

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return json({ error: 'Sessão inválida.' }, 401);

  /* ------------------------------------------------------- o áudio que chegou */

  let arquivo: File | null = null;
  let idioma = 'pt';
  let contexto = '';

  try {
    const form = await request.formData();
    const bruto = form.get('audio');
    if (bruto instanceof File) arquivo = bruto;

    const lang = form.get('idioma');
    if (typeof lang === 'string' && /^[a-z]{2}$/.test(lang)) idioma = lang;

    // Últimas palavras do segmento anterior. A OpenAI usa como pista para
    // continuar no mesmo assunto e grafar igual — sem isso, o nome próprio que
    // ela acertou num pedaço sai diferente no seguinte.
    const dica = form.get('contexto');
    if (typeof dica === 'string') contexto = dica.slice(0, 400);
  } catch {
    return json({ error: 'Pedido malformado.' }, 400);
  }

  if (!arquivo) return json({ error: 'Nenhum áudio recebido.' }, 400);
  if (arquivo.size === 0) return json({ error: 'O áudio chegou vazio.' }, 400);
  if (arquivo.size > MAX_BYTES) {
    return json({ error: 'Este trecho é grande demais. Grave em partes menores.' }, 413);
  }

  const tipo = (arquivo.type || '').toLowerCase().split(';')[0];
  if (tipo && !FORMATOS.has(tipo)) {
    return json({ error: `Formato de áudio não suportado: ${tipo}` }, 415);
  }

  /* --------------------------------------------- plano, modelo e quanto cabe */

  const { data: configRows, error: configErro } = await supabase.rpc('my_transcribe_config');
  if (configErro) return json({ error: configErro.message }, 400);

  const config = Array.isArray(configRows) ? configRows[0] : configRows;
  if (!config?.model) return json({ error: 'Plano sem transcrição configurada.' }, 503);

  const saldo = Number(config.saldo ?? 0);

  /**
   * A conferência é ANTES; o débito, DEPOIS, com a duração que a própria OpenAI
   * informa. É o único número confiável: a duração declarada pelo app pode ser
   * qualquer coisa, e o tamanho do arquivo não determina a duração — o mesmo
   * megabyte é meio minuto ou meia hora, dependendo da taxa.
   *
   * O preço disso é que quem está com um crédito consegue passar UM segmento
   * além. É limitado por desenho: o segmento tem poucos minutos, e a chamada
   * seguinte já encontra o saldo zerado e para. Trocar isso por um débito
   * estimado antes cobraria minutos que a pessoa não usou, que é pior.
   */
  if (saldo <= 0) {
    return json({ error: `NO_CREDITS:${saldo}:1`, saldo }, 402);
  }

  /* --------------------------------------------------------- chama a OpenAI */

  const envio = new FormData();
  envio.append('file', arquivo, arquivo.name || 'audio.m4a');
  envio.append('model', String(config.model));
  envio.append('language', idioma);
  // `verbose_json` é o que traz a duração; sem ela não há como debitar certo.
  envio.append('response_format', 'verbose_json');
  if (contexto) envio.append('prompt', contexto);

  let resposta: Response;
  try {
    resposta = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: envio,
    });
  } catch {
    return json({ error: 'Não foi possível falar com o serviço de transcrição.' }, 502);
  }

  if (!resposta.ok) {
    const detalhe = await resposta.text().catch(() => '');
    // A mensagem da OpenAI pode conter parte da chave ou da organização em
    // alguns erros; nunca é repassada para o aplicativo.
    console.error('openai transcricao falhou', resposta.status, detalhe.slice(0, 400));

    if (resposta.status === 429) {
      return json({ error: 'O serviço de transcrição está sobrecarregado. Tente em instantes.' }, 429);
    }
    if (resposta.status === 413) {
      return json({ error: 'Este trecho é grande demais para transcrever.' }, 413);
    }
    return json({ error: 'A transcrição falhou. Tente de novo.' }, 502);
  }

  const dados = await resposta.json().catch(() => null);
  const texto = typeof dados?.text === 'string' ? dados.text.trim() : '';
  const segundos = Number(dados?.duration);

  /* ------------------------------------------------------------- debita */

  /**
   * O custo sai da duração que a OpenAI informou, no preço do modelo que o
   * PLANO escolheu — nunca no que o app disser. Mínimo de um minuto: um trecho
   * de vinte segundos custa dinheiro e precisa aparecer no extrato.
   */
  const minutos =
    Number.isFinite(segundos) && segundos > 0 ? Math.max(1, Math.ceil(segundos / 60)) : 1;
  // O preço vem do banco, junto do modelo. Deduzi-lo do nome do modelo
  // funcionaria hoje e falharia calado no dia em que um preço mudasse.
  const custoUsd = minutos * Number(config.usd_min);

  /**
   * Debita DEPOIS do trabalho feito, e por isso pode ficar negativo em um
   * segmento. É de propósito: o texto já foi produzido e já foi pago à OpenAI.
   * Recusar o débito aqui perderia o consumo de vista e deixaria a pessoa
   * transcrevendo de graça para sempre — o oposto do que se quer proteger.
   */
  const { data: debitados, error: creditoErro } = await supabase.rpc('consume_credits', {
    p_custo_usd: custoUsd,
    p_motivo: 'transcricao',
    p_ref: null,
  });

  if (creditoErro) {
    // Não derruba a resposta: o texto é da pessoa e ela tem direito a ele. Mas
    // fica no registro do servidor, porque é dinheiro que saiu sem ser contado.
    console.error('falha ao debitar creditos de transcricao', creditoErro.message);
  }

  return json({
    texto,
    minutos,
    segundos: Number.isFinite(segundos) ? segundos : null,
    creditos: Number(debitados ?? 0),
    saldo: saldo - Number(debitados ?? 0),
  });
});
