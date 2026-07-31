import { getDb } from '@/database/client';

import { calcularOfensiva, diaDe, ultimosDias, type Ofensiva } from '../streak';

/**
 * O registro de "estudou hoje".
 *
 * Três coisas contam como estudo, e as três somam no mesmo dia: escrever nota,
 * revisar carta e gravar aula. Cada uma incrementa a sua coluna, e a existência
 * da linha é o que a ofensiva lê.
 *
 * O UPSERT é o coração disto. Sem `ON CONFLICT`, o segundo estudo do dia
 * explodiria na chave primária, e a alternativa (ler antes de escrever) tem
 * corrida entre a leitura e a escrita — duas revisões respondidas rápido
 * perderiam uma contagem.
 */

type Coluna = 'notes_written' | 'cards_reviewed' | 'minutes_recorded';

async function somar(coluna: Coluna, quanto: number): Promise<void> {
  if (quanto <= 0) return;
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO study_days (day, ${coluna}) VALUES (?, ?)
     ON CONFLICT(day) DO UPDATE SET ${coluna} = ${coluna} + excluded.${coluna}`,
    [diaDe(), quanto]
  );
}

export const registrarNota = () => somar('notes_written', 1);
export const registrarRevisao = () => somar('cards_reviewed', 1);
export const registrarGravacao = (minutos: number) =>
  somar('minutes_recorded', Math.max(0, Math.round(minutos)));

export type DiaDeEstudo = {
  dia: string;
  notas: number;
  cartas: number;
  minutos: number;
};

export async function listarDias(limite = 400): Promise<DiaDeEstudo[]> {
  const db = await getDb();
  const linhas = await db.getAllAsync<{
    day: string;
    notes_written: number;
    cards_reviewed: number;
    minutes_recorded: number;
  }>(
    `SELECT day, notes_written, cards_reviewed, minutes_recorded
     FROM study_days ORDER BY day DESC LIMIT ?`,
    [limite]
  );
  return linhas.map((l) => ({
    dia: l.day,
    notas: l.notes_written,
    cartas: l.cards_reviewed,
    minutos: l.minutes_recorded,
  }));
}

export type Painel = {
  ofensiva: Ofensiva;
  /** Últimas 12 semanas para o mapa de calor. */
  mapa: { dia: string; peso: number }[];
  /** Maior peso do mapa, para a escala de tom. */
  pico: number;
  totalDeNotas: number;
  totalDeCartas: number;
  totalDeMinutos: number;
  /** Cartas respondidas nos últimos sete dias. */
  cartasNaSemana: number;
  /** Quantas cartas existem, e quantas já foram aprendidas de verdade. */
  cartasVivas: number;
  cartasMaduras: number;
};

/**
 * Tudo que o painel mostra, numa consulta só de cada tabela.
 *
 * Poderia ser um hook por número, e cada um faria a sua ida ao banco. Seriam
 * sete idas para desenhar uma tela, e a tela pisca enquanto elas chegam em
 * ordens diferentes. Uma função que devolve o painel inteiro chega de uma vez.
 */
export async function carregarPainel(): Promise<Painel> {
  const db = await getDb();
  const dias = await listarDias();

  const pesos = new Map(dias.map((d) => [d.dia, d.cartas + d.notas]));
  const mapa = ultimosDias(pesos);
  const pico = mapa.reduce((maior, p) => Math.max(maior, p.peso), 0);

  const seteDiasAtras = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const semana = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM card_reviews WHERE reviewed_at >= ?',
    [seteDiasAtras]
  );

  // "Madura" é a carta com intervalo de três semanas ou mais. É o corte que o
  // Anki usa, e serve porque diz outra coisa que o total não diz: quantas você
  // realmente APRENDEU, em vez de quantas estão na fila.
  const cartas = await db.getFirstAsync<{ vivas: number; maduras: number }>(
    `SELECT COUNT(*) AS vivas,
            COUNT(*) FILTER (WHERE interval_days >= 21) AS maduras
     FROM cards WHERE suspended = 0`
  );

  // Dia coberto por protetor entra na conta da ofensiva junto com os
  // estudados — é exatamente para isso que o protetor existe. Fora daqui ele
  // não conta para nada: não vira nota escrita, não vira carta revisada, e não
  // aparece no mapa de calor, porque nesses dias não houve estudo nenhum.
  const protegidos = await db.getAllAsync<{ day: string }>('SELECT day FROM streak_shields');

  return {
    ofensiva: calcularOfensiva([...dias.map((d) => d.dia), ...protegidos.map((p) => p.day)]),
    mapa,
    pico,
    totalDeNotas: dias.reduce((s, d) => s + d.notas, 0),
    totalDeCartas: dias.reduce((s, d) => s + d.cartas, 0),
    totalDeMinutos: dias.reduce((s, d) => s + d.minutos, 0),
    cartasNaSemana: semana?.n ?? 0,
    cartasVivas: cartas?.vivas ?? 0,
    cartasMaduras: cartas?.maduras ?? 0,
  };
}
