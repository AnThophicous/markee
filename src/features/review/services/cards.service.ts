import { getDb } from '@/database/client';
import { generateId } from '@/utils/id';
import { now } from '@/utils/date';
import { registrarRevisao } from '@/features/stats/services/study-days.service';

import {
  CARTA_NOVA,
  proximaRevisao,
  responder,
  type Carta,
  type Resposta,
} from '../sm2';

/**
 * As cartas no banco.
 *
 * O SM-2 mora em `sm2.ts` e não encosta em banco nenhum; aqui é só guardar e
 * buscar. A separação é o que deixa o algoritmo testável de verdade — e o que
 * está errado num sistema de revisão espaçada quase sempre está no algoritmo,
 * não no SELECT.
 */

export type CartaDeRevisao = Carta & {
  id: string;
  noteId: string;
  /** A pergunta. Vem do trecho que a pessoa marcou. */
  frente: string;
  /** O que ela precisa lembrar. */
  verso: string;
  /** Quando volta, em milissegundos. */
  vencimentoEm: number;
  suspensa: boolean;
  criadaEm: number;
};

type LinhaDeCarta = {
  id: string;
  note_id: string;
  front: string;
  back: string;
  repetitions: number;
  interval_days: number;
  ease: number;
  lapses: number;
  due_at: number;
  suspended: number;
  created_at: number;
};

const mapear = (l: LinhaDeCarta): CartaDeRevisao => ({
  id: l.id,
  noteId: l.note_id,
  frente: l.front,
  verso: l.back,
  repeticoes: l.repetitions,
  intervalo: l.interval_days,
  facilidade: l.ease,
  quedas: l.lapses,
  vencimentoEm: l.due_at,
  suspensa: l.suspended === 1,
  criadaEm: l.created_at,
});

const COLUNAS =
  'id, note_id, front, back, repetitions, interval_days, ease, lapses, due_at, suspended, created_at';

/**
 * Cria uma carta a partir de um trecho.
 *
 * Nasce vencida (`due_at = agora`), e não daqui a um dia: quem acabou de marcar
 * um trecho quer estudá-lo hoje. Empurrar a carta nova para amanhã faz a pessoa
 * abrir a tela de revisão logo depois de criar dez cartas e encontrá-la vazia.
 */
export async function criarCarta(
  noteId: string,
  frente: string,
  verso: string
): Promise<CartaDeRevisao> {
  const db = await getDb();
  const id = generateId();
  const agora = now();

  await db.runAsync(
    `INSERT INTO cards (id, note_id, front, back, repetitions, interval_days, ease, lapses,
                        due_at, suspended, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      id,
      noteId,
      frente.trim(),
      verso.trim(),
      CARTA_NOVA.repeticoes,
      CARTA_NOVA.intervalo,
      CARTA_NOVA.facilidade,
      CARTA_NOVA.quedas,
      agora,
      agora,
      agora,
    ]
  );

  const linha = await db.getFirstAsync<LinhaDeCarta>(
    `SELECT ${COLUNAS} FROM cards WHERE id = ?`,
    [id]
  );
  return mapear(linha as LinhaDeCarta);
}

/** Cria várias de uma vez, numa transação só. */
export async function criarCartas(
  noteId: string,
  pares: { frente: string; verso: string }[]
): Promise<number> {
  const validos = pares.filter((p) => p.frente.trim() && p.verso.trim());
  if (validos.length === 0) return 0;

  const db = await getDb();
  const agora = now();
  await db.withTransactionAsync(async () => {
    for (const par of validos) {
      await db.runAsync(
        `INSERT INTO cards (id, note_id, front, back, repetitions, interval_days, ease, lapses,
                            due_at, suspended, created_at, updated_at)
         VALUES (?, ?, ?, ?, 0, 0, ?, 0, ?, 0, ?, ?)`,
        [generateId(), noteId, par.frente.trim(), par.verso.trim(), CARTA_NOVA.facilidade, agora, agora, agora]
      );
    }
  });
  return validos.length;
}

/**
 * A fila do dia.
 *
 * `limite` existe porque a fila cresce sem teto quando a pessoa some por um
 * mês: voltar e encontrar 300 cartas vencidas não motiva ninguém a revisar,
 * desmotiva. Vinte por sessão é o que cabe num intervalo de aula.
 */
export async function filaDeHoje(limite = 20): Promise<CartaDeRevisao[]> {
  const db = await getDb();
  const linhas = await db.getAllAsync<LinhaDeCarta>(
    `SELECT ${COLUNAS} FROM cards
     WHERE suspended = 0 AND due_at <= ?
     ORDER BY due_at ASC
     LIMIT ?`,
    [now(), limite]
  );
  return linhas.map(mapear);
}

export async function cartasDaNota(noteId: string): Promise<CartaDeRevisao[]> {
  const db = await getDb();
  const linhas = await db.getAllAsync<LinhaDeCarta>(
    `SELECT ${COLUNAS} FROM cards WHERE note_id = ? ORDER BY created_at ASC`,
    [noteId]
  );
  return linhas.map(mapear);
}

export type ResumoDaFila = {
  vencidas: number;
  novas: number;
  total: number;
  /** Quando a próxima carta vence, se a fila de hoje já acabou. */
  proximaEm: number | null;
};

export async function resumoDaFila(): Promise<ResumoDaFila> {
  const db = await getDb();
  const agora = now();
  const linha = await db.getFirstAsync<{ vencidas: number; novas: number; total: number }>(
    `SELECT
       COUNT(*) FILTER (WHERE due_at <= ?) AS vencidas,
       COUNT(*) FILTER (WHERE repetitions = 0) AS novas,
       COUNT(*) AS total
     FROM cards WHERE suspended = 0`,
    [agora]
  );
  const proxima = await db.getFirstAsync<{ due_at: number }>(
    'SELECT due_at FROM cards WHERE suspended = 0 AND due_at > ? ORDER BY due_at ASC LIMIT 1',
    [agora]
  );

  return {
    vencidas: linha?.vencidas ?? 0,
    novas: linha?.novas ?? 0,
    total: linha?.total ?? 0,
    proximaEm: proxima?.due_at ?? null,
  };
}

/**
 * Responde a carta e agenda a próxima.
 *
 * A revisão vai para `card_reviews` na MESMA transação que atualiza a carta. Se
 * fossem dois passos soltos, um fechar o app no meio deixaria o intervalo novo
 * gravado sem a revisão correspondente — e a estatística passaria a mentir para
 * sempre, sem jeito de reconstruir o que faltou.
 */
export async function responderCarta(
  carta: CartaDeRevisao,
  resposta: Resposta
): Promise<CartaDeRevisao> {
  const db = await getDb();
  const agora = now();
  const novo = responder(carta, resposta);
  const vencimento = proximaRevisao(novo, agora);

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE cards
       SET repetitions = ?, interval_days = ?, ease = ?, lapses = ?, due_at = ?, updated_at = ?
       WHERE id = ?`,
      [novo.repeticoes, novo.intervalo, novo.facilidade, novo.quedas, vencimento, agora, carta.id]
    );
    await db.runAsync(
      'INSERT INTO card_reviews (id, card_id, answer, interval_days, reviewed_at) VALUES (?, ?, ?, ?, ?)',
      [generateId(), carta.id, resposta, novo.intervalo, agora]
    );
  });

  await registrarRevisao();

  return { ...carta, ...novo, vencimentoEm: vencimento };
}

export async function apagarCarta(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM cards WHERE id = ?', [id]);
}

/**
 * Suspende em vez de apagar.
 *
 * Apagar perde o histórico junto, e o histórico é o que a estatística conta.
 * Suspender tira da fila e mantém o passado inteiro.
 */
export async function suspenderCarta(id: string, suspensa: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE cards SET suspended = ?, updated_at = ? WHERE id = ?', [
    suspensa ? 1 : 0,
    now(),
    id,
  ]);
}
