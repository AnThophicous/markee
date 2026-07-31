import { getDb } from '@/database/client';

import { protecaoNecessaria, protetoresDisponiveis } from '../conquistas';
import { diaDe } from '../streak';

export type EstadoDoProtetor = {
  disponiveis: number;
  teto: number;
  /** Dias que já foram salvos por um protetor, do mais novo para o mais velho. */
  usados: string[];
  /** Dias salvos NESTA abertura do app — a tela avisa sobre eles. */
  salvosAgora: string[];
};

async function diasProtegidos(): Promise<string[]> {
  const db = await getDb();
  const linhas = await db.getAllAsync<{ day: string }>(
    'SELECT day FROM streak_shields ORDER BY day DESC'
  );
  return linhas.map((l) => l.day);
}

/**
 * Confere se a ofensiva precisa ser salva, e salva.
 *
 * Roda ao abrir a tela de ofensiva. Não roda ao abrir o app inteiro de
 * propósito: gastar um protetor é uma coisa que a pessoa tem de VER acontecer,
 * e um aviso desses passando na tela inicial enquanto ela vai para outro lugar
 * seria o pior dos dois mundos — o protetor some e ela não fica sabendo.
 *
 * A escrita é `INSERT OR IGNORE`: abrir a tela duas vezes seguidas não gasta
 * dois protetores pelo mesmo dia, mesmo que a leitura e a escrita se cruzem.
 */
export async function conferirProtetor(pro = false): Promise<EstadoDoProtetor> {
  const db = await getDb();

  const total = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM study_days');
  const protegidos = await diasProtegidos();

  const disponiveis = protetoresDisponiveis(total?.n ?? 0, protegidos.length, pro);

  const estudados = await db.getAllAsync<{ day: string }>('SELECT day FROM study_days');
  // Dia coberto por protetor conta como dia estudado para achar o buraco — sem
  // isso, um buraco já protegido seria protegido de novo no dia seguinte.
  const comEstudo = [...estudados.map((l) => l.day), ...protegidos];

  const aProteger = protecaoNecessaria(comEstudo, disponiveis);
  const agora = Date.now();
  for (const dia of aProteger) {
    await db.runAsync('INSERT OR IGNORE INTO streak_shields (day, spent_at) VALUES (?, ?)', [
      dia,
      agora,
    ]);
  }

  return {
    disponiveis: protetoresDisponiveis(total?.n ?? 0, protegidos.length + aProteger.length, pro),
    teto: pro ? 3 : 2,
    usados: [...aProteger, ...protegidos].sort().reverse(),
    salvosAgora: aProteger,
  };
}

/** Os dias que contam para a ofensiva: os estudados mais os protegidos. */
export async function diasQueContam(): Promise<string[]> {
  const db = await getDb();
  const estudados = await db.getAllAsync<{ day: string }>('SELECT day FROM study_days');
  return [...estudados.map((l) => l.day), ...(await diasProtegidos())];
}

/** Os sete dias da semana atual, para a tira do topo. */
export async function semanaAtual(hoje = Date.now()): Promise<
  { dia: string; estudou: boolean; protegido: boolean; ehHoje: boolean }[]
> {
  const db = await getDb();
  const estudados = new Set(
    (await db.getAllAsync<{ day: string }>('SELECT day FROM study_days')).map((l) => l.day)
  );
  const protegidos = new Set(await diasProtegidos());

  const d = new Date(hoje);
  // A semana começa no domingo, como no calendário brasileiro. `getDay()` já
  // devolve 0 para domingo, então o recuo é ele mesmo.
  const inicio = new Date(d);
  inicio.setDate(d.getDate() - d.getDay());

  const hojeStr = diaDe(hoje);
  return Array.from({ length: 7 }, (_, i) => {
    const data = new Date(inicio);
    data.setDate(inicio.getDate() + i);
    const dia = diaDe(data);
    return {
      dia,
      estudou: estudados.has(dia),
      protegido: protegidos.has(dia),
      ehHoje: dia === hojeStr,
    };
  });
}
