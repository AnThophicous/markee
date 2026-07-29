/**
 * A ofensiva: quantos dias seguidos de estudo.
 *
 * Função pura sobre uma lista de dias, sem banco e sem relógio, porque a parte
 * difícil aqui não é contar — é decidir o que conta.
 */

/** O dia do calendário, em AAAA-MM-DD, no fuso de quem está estudando. */
export function diaDe(instante: number | Date = Date.now()): string {
  const d = instante instanceof Date ? instante : new Date(instante);
  // `toISOString` seria mais curto e estaria errado: ele converte para UTC, e
  // quem estuda às 22h no Brasil apareceria estudando no dia seguinte. A
  // ofensiva é sobre o dia que a pessoa VIU no relógio dela.
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export const diasAtras = (n: number, base: number = Date.now()): string =>
  diaDe(base - n * 24 * 60 * 60 * 1000);

export type Ofensiva = {
  /** Dias seguidos até hoje. */
  atual: number;
  /** O melhor que já foi. */
  recorde: number;
  /** Se hoje ainda não conta, mas ontem contou — a ofensiva está por um fio. */
  emRisco: boolean;
};

/**
 * Conta os dias seguidos.
 *
 * A regra que importa: HOJE AINDA NÃO CONTA CONTRA VOCÊ. Se a pessoa estudou
 * ontem e ainda não estudou hoje, a ofensiva continua de pé — ela só quebra
 * quando um dia inteiro passa em branco. Sem isso, a ofensiva apareceria zerada
 * toda manhã, e um número que zera sozinho todo dia não motiva ninguém.
 */
export function calcularOfensiva(dias: string[], hoje = diaDe()): Ofensiva {
  const conjunto = new Set(dias);
  const ontem = diasAtras(1, new Date(`${hoje}T12:00:00`).getTime());

  // De onde começar a contar para trás: de hoje se hoje já conta, senão de
  // ontem. Começar sempre de hoje daria zero em toda manhã antes do primeiro
  // estudo.
  const inicio = conjunto.has(hoje) ? hoje : conjunto.has(ontem) ? ontem : null;

  let atual = 0;
  if (inicio) {
    const base = new Date(`${inicio}T12:00:00`).getTime();
    while (conjunto.has(diasAtras(atual, base))) atual += 1;
  }

  return {
    atual,
    recorde: maiorSequencia(dias),
    emRisco: atual > 0 && !conjunto.has(hoje),
  };
}

function maiorSequencia(dias: string[]): number {
  if (dias.length === 0) return 0;
  const ordenados = [...new Set(dias)].sort();
  let melhor = 1;
  let corrente = 1;

  for (let i = 1; i < ordenados.length; i += 1) {
    const anterior = new Date(`${ordenados[i - 1]}T12:00:00`).getTime();
    const seguinte = diasAtras(-1, anterior);
    corrente = ordenados[i] === seguinte ? corrente + 1 : 1;
    if (corrente > melhor) melhor = corrente;
  }
  return melhor;
}

/**
 * As últimas semanas, para o gráfico de quadradinhos.
 *
 * Devolve sempre `semanas * 7` dias, inclusive os vazios: o desenho precisa dos
 * buracos tanto quanto dos cheios, e deixar a tela filtrar dias faltantes
 * espalharia a mesma regra por dois lugares.
 */
export function ultimosDias(
  registros: Map<string, number>,
  semanas = 12,
  hoje = Date.now()
): { dia: string; peso: number }[] {
  const total = semanas * 7;
  return Array.from({ length: total }, (_, i) => {
    const dia = diasAtras(total - 1 - i, hoje);
    return { dia, peso: registros.get(dia) ?? 0 };
  });
}

/**
 * A intensidade do quadradinho, de 0 a 4.
 *
 * Escala relativa ao próprio histórico, e não absoluta: quem revisa 5 cartas
 * por dia e quem revisa 80 precisam ver a mesma variação de tom. Uma escala
 * fixa deixaria o primeiro com o mapa todo apagado.
 */
export function intensidade(peso: number, maximo: number): 0 | 1 | 2 | 3 | 4 {
  if (peso <= 0) return 0;
  if (maximo <= 1) return 4;
  const fracao = peso / maximo;
  if (fracao > 0.75) return 4;
  if (fracao > 0.5) return 3;
  if (fracao > 0.25) return 2;
  return 1;
}
