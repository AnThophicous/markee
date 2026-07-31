import { getDb } from '@/database/client';
import { chaveDeNota, ligacoesDe } from '@/features/editor/utils/markdown-parser';
import { createNote } from './notes.service';

export type NotaCitada = {
  id: string;
  titulo: string;
  emoji: string | null;
};

/**
 * Ligações entre notas — o `[[assim]]`.
 *
 * NÃO existe tabela de ligações, e isso é decisão, não preguiça. Uma tabela
 * teria de ser mantida em sincronia a cada tecla digitada; ficaria errada na
 * primeira vez que uma escrita falhasse no meio, e o defeito só apareceria
 * semanas depois como uma menção fantasma que ninguém consegue explicar.
 *
 * O texto da nota É a fonte da verdade. Achar quem cita quem é uma varredura
 * dos títulos e conteúdos, que para a quantidade de notas que uma pessoa
 * escreve custa alguns milissegundos. Quando isso pesar — na casa dos milhares
 * de notas — o lugar certo de resolver é um índice FTS, não uma tabela paralela
 * escrita à mão.
 */

type Linha = { id: string; title: string; emoji: string | null; content: string };

async function todasAsNotas(): Promise<Linha[]> {
  const db = await getDb();
  return db.getAllAsync<Linha>(
    'SELECT id, title, emoji, content FROM notes WHERE is_deleted = 0'
  );
}

/** A nota com este título, comparando do jeito que uma pessoa compararia. */
export async function acharPorTitulo(titulo: string): Promise<NotaCitada | null> {
  const alvo = chaveDeNota(titulo);
  if (!alvo) return null;

  const achada = (await todasAsNotas()).find((n) => chaveDeNota(n.title) === alvo);
  return achada ? { id: achada.id, titulo: achada.title, emoji: achada.emoji } : null;
}

/**
 * Quem cita esta nota.
 *
 * Compara pelo TÍTULO e não pelo id porque é assim que a ligação é escrita: se
 * a nota for renomeada, as menções antigas param de casar — e isso é o
 * comportamento certo, porque o texto das outras notas continua dizendo o nome
 * velho. Reescrever as notas alheias para acompanhar a renomeação seria mexer
 * no que a pessoa escreveu sem ela pedir.
 */
export async function quemCita(noteId: string, titulo: string): Promise<NotaCitada[]> {
  const alvo = chaveDeNota(titulo);
  if (!alvo) return [];

  return (await todasAsNotas())
    .filter((n) => n.id !== noteId && ligacoesDe(n.content).some((l) => chaveDeNota(l) === alvo))
    .map((n) => ({ id: n.id, titulo: n.title, emoji: n.emoji }));
}

/** As notas que ESTA cita, já resolvidas — e as que ainda não existem. */
export async function oQueEstaNotaCita(conteudo: string): Promise<{
  existentes: NotaCitada[];
  faltando: string[];
}> {
  const nomes = ligacoesDe(conteudo);
  if (nomes.length === 0) return { existentes: [], faltando: [] };

  const notas = await todasAsNotas();
  const porChave = new Map(notas.map((n) => [chaveDeNota(n.title), n]));

  const existentes: NotaCitada[] = [];
  const faltando: string[] = [];

  for (const nome of nomes) {
    const achada = porChave.get(chaveDeNota(nome));
    if (achada) existentes.push({ id: achada.id, titulo: achada.title, emoji: achada.emoji });
    else faltando.push(nome);
  }

  return { existentes, faltando };
}

/**
 * Abre a nota citada, criando-a se ainda não existir.
 *
 * Criar em vez de dizer "não encontrada" é o que faz a ligação valer a pena:
 * escrever `[[Ciclo de Krebs]]` no meio da aula e tocar depois para começar
 * aquela nota é o fluxo inteiro. Obrigar a pessoa a voltar, criar a nota, dar o
 * nome exato e voltar de novo mataria o recurso no primeiro uso.
 */
export async function abrirOuCriar(titulo: string): Promise<string> {
  const achada = await acharPorTitulo(titulo);
  if (achada) return achada.id;

  const nova = await createNote({ title: titulo.trim(), content: '' });
  return nova.id;
}
