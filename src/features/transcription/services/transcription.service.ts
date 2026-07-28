import { supabase } from '@/services/supabase';
import { lerClassificacao, paraMarkdown, promptDeClassificacao, type Trecho } from '../classify';

/**
 * Gravar uma aula e transformá-la em nota.
 *
 * São duas etapas e duas funções de borda, de propósito:
 *
 *   1. `transcrever` — áudio vira texto. Um segmento por chamada, porque a
 *      função de borda tem 150s de parede e uma aula não cabe nisso.
 *   2. `ai` — o texto inteiro vira trechos rotulados. UMA chamada só, com tudo
 *      junto: classificar pedaço por pedaço perderia o contexto, e "isso cai na
 *      prova" só é tarefa para quem viu a frase anterior.
 *
 * As duas cobram crédito, cada uma pelo que custa: minuto de áudio numa,
 * token na outra.
 */

export type ResultadoDeSegmento = {
  texto: string;
  minutos: number;
  saldo: number;
};

/**
 * Manda um pedaço de áudio e recebe o texto dele.
 *
 * `contexto` são as últimas palavras do segmento anterior. Sem elas, o nome
 * próprio que a transcrição acertou num pedaço sai grafado diferente no
 * seguinte — e a nota fica com "mitocôndria" e "mito côndria" na mesma página.
 */
export async function transcreverSegmento(
  uri: string,
  contexto = ''
): Promise<ResultadoDeSegmento> {
  const forma = new FormData();

  // O React Native aceita este formato para arquivo local em FormData; um Blob
  // de verdade exigiria ler o arquivo inteiro na memória, e uma aula longa
  // derrubaria o app por falta de memória antes de terminar de subir.
  forma.append('audio', {
    uri,
    name: 'trecho.m4a',
    type: 'audio/m4a',
  } as unknown as Blob);
  forma.append('idioma', 'pt');
  if (contexto) forma.append('contexto', contexto);

  const { data, error } = await supabase.functions.invoke('transcrever', { body: forma });

  if (error) throw new Error(traduzir(error.message));
  if (data?.error) throw new Error(traduzir(String(data.error)));

  return {
    texto: String(data?.texto ?? ''),
    minutos: Number(data?.minutos ?? 0),
    saldo: Number(data?.saldo ?? 0),
  };
}

/**
 * As últimas palavras de um texto, para servirem de pista ao próximo segmento.
 *
 * Corta em palavra inteira: metade de uma palavra como pista atrapalha mais do
 * que ajuda, porque o modelo tenta completá-la e erra a primeira frase.
 */
export function pistaDoFim(texto: string, palavras = 25): string {
  const partes = texto.trim().split(/\s+/);
  return partes.slice(Math.max(0, partes.length - palavras)).join(' ');
}

/**
 * Separa a transcrição em matéria, tarefa e ruído.
 *
 * Se a classificação falhar por qualquer motivo — sem crédito, sem rede, modelo
 * fora do ar —, devolve a transcrição inteira como conteúdo. A pessoa gravou a
 * aula e pagou pelos minutos; ficar sem a nota porque o segundo passo falhou
 * seria cobrar por um trabalho não entregue.
 */
export async function classificarAula(texto: string): Promise<Trecho[]> {
  const limpo = texto.trim();
  if (!limpo) return [];

  try {
    const { data, error } = await supabase.functions.invoke('ai', {
      body: {
        prompt: promptDeClassificacao(limpo),
        // Teto largo: a resposta repete a transcrição inteira dentro do JSON,
        // então ela é necessariamente maior que a entrada. Curto demais corta a
        // resposta no meio e o JSON chega quebrado.
        maxTokens: 4000,
      },
    });

    if (error || data?.error) return [{ texto: limpo, tipo: 'conteudo' }];

    return lerClassificacao(String(data?.content ?? ''), limpo);
  } catch {
    return [{ texto: limpo, tipo: 'conteudo' }];
  }
}

/** A nota pronta, a partir dos trechos já classificados. */
export function montarNota(trechos: Trecho[]): string {
  return paraMarkdown(trechos);
}

function traduzir(mensagem: string): string {
  const m = mensagem.toLowerCase();
  if (m.includes('no_credits')) return 'Seus créditos acabaram. Veja os pacotes nas configurações.';
  if (m.includes('não configurada')) return 'A transcrição ainda não está ligada no servidor.';
  if (m.includes('grande demais')) return 'Esse trecho ficou grande demais. Grave em partes menores.';
  return mensagem;
}
