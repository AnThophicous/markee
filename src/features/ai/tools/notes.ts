import { searchNotes } from '@/features/notes/services/notes.service';

/**
 * Leitura das notas da própria pessoa.
 *
 * Esta é a única ferramenta que toca dado pessoal, e por isso ela só roda
 * depois de um "permitir" explícito na interface — a permissão é conferida em
 * quem chama (o laço do agente), não aqui.
 *
 * As notas moram no SQLite do aparelho. Isso obriga o laço de ferramentas a
 * rodar no celular: uma função no servidor não teria como ler nada disso, nem
 * se quisesse.
 */

const MAX_NOTES = 5;
const MAX_CHARS_PER_NOTE = 900;

export async function readNotesTool(query: string): Promise<string> {
  const term = query.trim();
  if (!term) return 'Diga o que procurar nas notas.';

  const notes = await searchNotes(term, {});

  if (notes.length === 0) {
    return `Nenhuma nota encontrada para "${term}".`;
  }

  // Só os primeiros resultados, e cada um cortado: mandar o caderno inteiro
  // estoura o contexto do modelo e ainda expõe mais do que o necessário.
  const chosen = notes.slice(0, MAX_NOTES);

  const rendered = chosen
    .map((note) => {
      const body = note.content.length > MAX_CHARS_PER_NOTE
        ? note.content.slice(0, MAX_CHARS_PER_NOTE) + '…'
        : note.content;
      const tags = note.tags.length > 0 ? ` [tags: ${note.tags.join(', ')}]` : '';
      return `--- ${note.title || 'Sem título'}${tags}\n${body}`;
    })
    .join('\n\n');

  const extra = notes.length > chosen.length ? `\n\n(mais ${notes.length - chosen.length} notas não mostradas)` : '';
  return `${notes.length} nota(s) encontrada(s) para "${term}":\n\n${rendered}${extra}`;
}
