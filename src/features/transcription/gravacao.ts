/**
 * A política da gravação de aula.
 *
 * Função pura, sem microfone e sem rede, porque as decisões difíceis aqui são
 * de aritmética e não de áudio: de quanto em quanto tempo cortar, o que fazer
 * com o pedaço que falhou, quando avisar que o disco vai acabar.
 *
 * POR QUE CORTAR EM PEDAÇOS. A função de borda que transcreve tem 150 segundos
 * de parede, e a OpenAI recusa arquivo acima de 25 MB. Uma aula de cinquenta
 * minutos não cabe em nenhum dos dois. Então a gravação é cortada enquanto
 * acontece, e cada pedaço sobe assim que fecha — quando a aula termina, quase
 * tudo já está transcrito.
 *
 * O QUE SE PERDE NO CORTE. Parar e recomeçar o gravador leva alguns
 * milissegundos, e o que for falado nesse intervalo se perde. Em dois minutos
 * de pedaço, são uns 2,5 segundos numa aula inteira de cinquenta minutos. Não é
 * zero, e não dá para fingir que é: o que reduz o estrago é a PISTA — as
 * últimas palavras de um pedaço vão como contexto do seguinte, e o modelo
 * costuma emendar a frase partida sozinho.
 */

/**
 * Dois minutos por pedaço.
 *
 * Vem da parede da função de borda, não de gosto. A transcrição leva algo entre
 * um quinto e metade da duração do áudio; dois minutos de áudio dão de 25 a 60
 * segundos de processamento, com folga confortável dentro dos 150. Pedaço de
 * cinco minutos caberia na conta média e estouraria nos dias ruins da OpenAI —
 * e estourar significa perder o pedaço, não esperar mais.
 */
export const SEGUNDOS_POR_PEDACO = 120;

/**
 * Áudio de fala, não de música.
 *
 * 16 kHz mono é exatamente o que o Whisper usa por dentro: mandar 44,1 kHz
 * estéreo faz o servidor reamostrar para 16 kHz mono antes de transcrever, ou
 * seja, sobe-se cinco vezes mais bytes para o mesmo resultado. Numa aula
 * inteira, pelo 4G de quem está na faculdade, a diferença é entre 12 MB e 60.
 */
export const AUDIO_DE_FALA = {
  extension: '.m4a',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
  android: { outputFormat: 'mpeg4', audioEncoder: 'aac' },
  ios: { outputFormat: 'aac ', audioQuality: 64, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
  web: { mimeType: 'audio/webm', bitsPerSecond: 32000 },
} as const;

/** Bytes por segundo, no formato acima. */
const BYTES_POR_SEGUNDO = 32000 / 8;

export const bytesDe = (segundos: number) => Math.round(Math.max(0, segundos) * BYTES_POR_SEGUNDO);

/**
 * Quanto tempo ainda cabe no disco.
 *
 * A margem de 10% e o piso de 50 MB não são superstição: o Android começa a
 * matar aplicativo quando o disco fica muito perto do fim, e ser morto no meio
 * de uma aula perde o que ainda não subiu. Melhor parar antes, com aviso.
 */
export function segundosQueCabem(bytesLivres: number): number {
  const reservado = Math.max(50 * 1024 * 1024, bytesLivres * 0.1);
  return Math.max(0, Math.floor((bytesLivres - reservado) / BYTES_POR_SEGUNDO));
}

export type EstadoDoPedaco = 'gravando' | 'esperando' | 'enviando' | 'pronto' | 'falhou';

export type Pedaco = {
  indice: number;
  uri: string;
  segundos: number;
  estado: EstadoDoPedaco;
  texto: string;
  /** Quantas vezes já se tentou enviar. */
  tentativas: number;
};

/**
 * O próximo pedaço a enviar.
 *
 * EM ORDEM, sempre, e um por vez. Enviar em paralelo seria mais rápido e
 * quebraria a pista: o contexto de um pedaço são as últimas palavras do
 * anterior, e sem elas o nome próprio que a transcrição acertou num pedaço sai
 * grafado diferente no seguinte.
 *
 * O que falhou volta para o fim da fila, e não para o começo: insistir no
 * pedaço quebrado enquanto os outros esperam trava a aula inteira num erro que
 * talvez seja só daquele arquivo.
 */
export function proximoParaEnviar(pedacos: Pedaco[], maxTentativas = 3): Pedaco | null {
  const esperando = pedacos.filter((p) => p.estado === 'esperando' && p.tentativas < maxTentativas);
  if (esperando.length === 0) return null;

  const nunca = esperando.filter((p) => p.tentativas === 0);
  const fila = nunca.length > 0 ? nunca : esperando;
  return fila.reduce((menor, p) => (p.indice < menor.indice ? p : menor));
}

/** A pista para o próximo pedaço: as últimas palavras do último já transcrito. */
export function pistaPara(pedacos: Pedaco[], indice: number, palavras = 25): string {
  const anterior = pedacos
    .filter((p) => p.indice < indice && p.estado === 'pronto' && p.texto.trim())
    .sort((a, b) => b.indice - a.indice)[0];

  if (!anterior) return '';
  const partes = anterior.texto.trim().split(/\s+/);
  return partes.slice(Math.max(0, partes.length - palavras)).join(' ');
}

/**
 * O texto da aula, na ordem, com o que faltou marcado.
 *
 * O pedaço que falhou vira uma marca visível em vez de sumir. Costurar o texto
 * como se nada tivesse faltado é a pior saída possível: a pessoa lê uma nota
 * que parece completa, estuda por ela, e o buraco só aparece na prova.
 */
export function montarTexto(pedacos: Pedaco[]): string {
  return [...pedacos]
    .sort((a, b) => a.indice - b.indice)
    .map((p) =>
      p.estado === 'pronto'
        ? p.texto.trim()
        : p.estado === 'falhou'
          ? `⚠️ [${minutosEmPalavras(p.indice * SEGUNDOS_POR_PEDACO)} — este trecho não foi transcrito]`
          : ''
    )
    .filter(Boolean)
    .join('\n\n');
}

export type Progresso = {
  prontos: number;
  total: number;
  falharam: number;
  /** De 0 a 1. */
  fracao: number;
  /** Ainda há pedaço esperando ou enviando. */
  trabalhando: boolean;
};

export function progressoDe(pedacos: Pedaco[]): Progresso {
  const fechados = pedacos.filter((p) => p.estado !== 'gravando');
  const prontos = fechados.filter((p) => p.estado === 'pronto').length;
  const falharam = fechados.filter((p) => p.estado === 'falhou').length;
  const total = fechados.length;

  return {
    prontos,
    total,
    falharam,
    fracao: total > 0 ? (prontos + falharam) / total : 0,
    trabalhando: pedacos.some((p) => p.estado === 'esperando' || p.estado === 'enviando'),
  };
}

/** mm:ss, para o cronômetro. */
export function relogio(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const dois = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${dois(m)}:${dois(r)}` : `${dois(m)}:${dois(r)}`;
}

/** "12 minutos", para texto corrido. */
export function minutosEmPalavras(segundos: number): string {
  const m = Math.round(segundos / 60);
  if (m < 1) return 'menos de 1 minuto';
  return m === 1 ? '1 minuto' : `${m} minutos`;
}
