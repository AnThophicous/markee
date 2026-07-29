/**
 * SM-2: quando mostrar a carta de novo.
 *
 * O algoritmo do SuperMemo 2, que é a base do Anki e de quase tudo que faz
 * revisão espaçada. A ideia inteira cabe numa frase: o intervalo cresce sozinho
 * enquanto você acerta, e desaba para o começo quando você erra.
 *
 * Isto aqui é função pura de propósito — entra o estado da carta e a nota que a
 * pessoa deu, sai o estado novo. Nada de banco, nada de relógio do sistema.
 * É o único jeito de testar o que importa: o intervalo depois de seis acertos
 * seguidos, o que acontece com a facilidade depois de três erros, o piso que
 * impede a carta de virar spam diário para sempre.
 */

/** A facilidade é guardada em MILÉSIMOS. */
export const FACILIDADE_INICIAL = 2500;

/**
 * O piso da facilidade, 1.3 no artigo original.
 *
 * Sem piso, uma carta errada muitas vezes chega a facilidade 1.0 e o intervalo
 * para de crescer: ela volta todo dia, para sempre, e envenena a fila. Com
 * piso, mesmo a carta mais difícil eventualmente espaça.
 */
export const FACILIDADE_MINIMA = 1300;

export type Carta = {
  /** Quantos acertos seguidos. Zera a cada erro. */
  repeticoes: number;
  /** Dias até a próxima revisão. */
  intervalo: number;
  /** Em milésimos: 2500 = 2,5. */
  facilidade: number;
  /** Quantas vezes já foi esquecida. Só para estatística. */
  quedas: number;
};

/**
 * O que a pessoa aperta depois de virar a carta.
 *
 * São quatro botões e não os seis níveis do artigo original porque ninguém
 * consegue distinguir "quase lembrei" de "lembrei com muito esforço" de forma
 * consistente — e uma escala que a pessoa preenche no chute vira ruído dentro
 * do cálculo. Quatro opções separam o que dá para separar de verdade.
 */
export type Resposta = 'errei' | 'dificil' | 'bom' | 'facil';

/** A conversão para a escala 0..5 do artigo. */
const QUALIDADE: Record<Resposta, number> = {
  errei: 0,
  dificil: 3,
  bom: 4,
  facil: 5,
};

export const CARTA_NOVA: Carta = {
  repeticoes: 0,
  intervalo: 0,
  facilidade: FACILIDADE_INICIAL,
  quedas: 0,
};

/**
 * O intervalo depois de responder.
 *
 * Os dois primeiros degraus são fixos (1 dia, depois 6) porque multiplicar a
 * facilidade por um intervalo de zero dia daria zero para sempre. Do terceiro
 * em diante é que a facilidade entra.
 *
 * DUAS DIFERENÇAS de propósito em relação ao artigo de 1988, para quem for
 * conferir contra a fonte:
 *
 *   1. O artigo diz para reiniciar a carta errada SEM mexer na facilidade.
 *      Aqui a facilidade cai também. Sem isso, a carta que você erra sempre
 *      mantém facilidade 2.5, e no dia em que enfim acerta o intervalo salta
 *      dois meses de uma vez — justo a carta que menos merece esse voto de
 *      confiança.
 *   2. O intervalo usa a facilidade JÁ ajustada, não a anterior. É uma revisão
 *      de defasagem, e faz a resposta valer no mesmo turno em que foi dada.
 */
export function responder(carta: Carta, resposta: Resposta): Carta {
  const q = QUALIDADE[resposta];
  const facilidade = ajustarFacilidade(carta.facilidade, q);

  // Errou: volta para o começo. O intervalo vira 1 dia, e NÃO zero — carta que
  // reaparece no mesmo instante em que foi errada não é revisão, é a pessoa
  // decorando a tela. Dormir entre uma tentativa e outra é metade do método.
  if (q < 3) {
    return { repeticoes: 0, intervalo: 1, facilidade, quedas: carta.quedas + 1 };
  }

  const repeticoes = carta.repeticoes + 1;
  const intervalo =
    repeticoes === 1 ? 1 : repeticoes === 2 ? 6 : Math.round((carta.intervalo * facilidade) / 1000);

  return {
    repeticoes,
    // O teto de dez anos não é sobre o método, é sobre aritmética: sem ele o
    // intervalo cresce até estourar o inteiro do SQLite e a data de revisão
    // vira lixo. Dez anos já é "essa você sabe".
    intervalo: Math.min(intervalo, 3650),
    facilidade,
    quedas: carta.quedas,
  };
}

/**
 * A facilidade nova, pela fórmula do artigo.
 *
 * `f' = f + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))`
 *
 * Em milésimos para não acumular erro de ponto flutuante: a facilidade é
 * multiplicada por si mesma a cada revisão, então um centésimo de desvio hoje
 * vira dias de diferença depois de um ano.
 */
function ajustarFacilidade(facilidade: number, q: number): number {
  const d = 5 - q;
  const delta = Math.round(100 - d * (80 + d * 20));
  return Math.max(FACILIDADE_MINIMA, facilidade + delta);
}

/** Quando a carta volta, em milissegundos. */
export const proximaRevisao = (carta: Carta, agora: number): number =>
  agora + carta.intervalo * 24 * 60 * 60 * 1000;

/**
 * O intervalo em palavras, para o botão dizer o que vai acontecer.
 *
 * Mostrar isso ANTES de apertar é o que faz a pessoa responder com honestidade:
 * quando "Fácil" anuncia "3 meses", ninguém aperta fácil por preguiça.
 */
export function intervaloEmPalavras(dias: number): string {
  if (dias <= 0) return 'agora';
  if (dias === 1) return 'amanhã';
  if (dias < 30) return `${dias} dias`;
  const meses = Math.round(dias / 30);
  if (meses < 12) return meses === 1 ? '1 mês' : `${meses} meses`;
  const anos = Math.round(dias / 365);
  return anos === 1 ? '1 ano' : `${anos} anos`;
}

/** O que cada botão vai fazer, para a tela mostrar antes do toque. */
export function previsao(carta: Carta): Record<Resposta, string> {
  const respostas: Resposta[] = ['errei', 'dificil', 'bom', 'facil'];
  return Object.fromEntries(
    respostas.map((r) => [r, intervaloEmPalavras(responder(carta, r).intervalo)])
  ) as Record<Resposta, string>;
}
