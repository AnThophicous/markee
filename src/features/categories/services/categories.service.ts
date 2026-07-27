import { getDb } from '@/database/client';
import type { Category } from '@/types';
import { now } from '@/utils/date';
import { generateId } from '@/utils/id';

/**
 * Categorias das notas.
 *
 * Diferente de pasta: pasta arquiva (a nota sai da vista), categoria etiqueta
 * (a nota continua na lista, com uma marca colorida). São coisas separadas de
 * propósito — quem quiser pode usar as duas ao mesmo tempo.
 */

type CategoryRow = {
  id: string;
  name: string;
  color: string;
  icon: string;
  position: number;
  created_at: number;
};

const mapCategory = (row: CategoryRow): Category => ({
  id: row.id,
  name: row.name,
  color: row.color,
  icon: row.icon,
  position: row.position,
  createdAt: row.created_at,
});

export async function listCategories(): Promise<Category[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<CategoryRow>(
    'SELECT * FROM categories ORDER BY position ASC, created_at ASC'
  );
  return rows.map(mapCategory);
}

/** Quantas notas cada categoria tem. A contagem some no filtro quando é zero. */
export async function countNotesByCategory(): Promise<Record<string, number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ category_id: string | null; total: number }>(
    `SELECT category_id, COUNT(*) as total
     FROM notes
     WHERE is_deleted = 0 AND category_id IS NOT NULL
     GROUP BY category_id`
  );

  const contagem: Record<string, number> = {};
  for (const row of rows) {
    if (row.category_id) contagem[row.category_id] = row.total;
  }
  return contagem;
}

export async function createCategory(input: {
  name: string;
  color: string;
  icon: string;
}): Promise<Category> {
  const db = await getDb();
  const id = generateId();
  const timestamp = now();

  // Entra no fim da lista. `MAX(position)` devolve null na tabela vazia, e o
  // COALESCE evita que a primeira categoria criada nasça com posição nula.
  const linha = await db.getFirstAsync<{ proxima: number }>(
    'SELECT COALESCE(MAX(position), -1) + 1 AS proxima FROM categories'
  );

  const position = linha?.proxima ?? 0;

  await db.runAsync(
    'INSERT INTO categories (id, name, color, icon, position, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    input.name.trim(),
    input.color,
    input.icon,
    position,
    timestamp
  );

  return { id, name: input.name.trim(), color: input.color, icon: input.icon, position, createdAt: timestamp };
}

export async function updateCategory(
  id: string,
  patch: Partial<Pick<Category, 'name' | 'color' | 'icon'>>
): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const params: (string | number)[] = [];

  if (patch.name !== undefined) {
    sets.push('name = ?');
    params.push(patch.name.trim());
  }
  if (patch.color !== undefined) {
    sets.push('color = ?');
    params.push(patch.color);
  }
  if (patch.icon !== undefined) {
    sets.push('icon = ?');
    params.push(patch.icon);
  }

  // Sem nada para mudar, um UPDATE com SET vazio seria erro de sintaxe.
  if (sets.length === 0) return;

  params.push(id);
  await db.runAsync(`UPDATE categories SET ${sets.join(', ')} WHERE id = ?`, params);
}

/**
 * Apagar a categoria não apaga as notas: elas voltam a ficar sem categoria.
 * A coluna tem ON DELETE SET NULL, mas o UPDATE é explícito porque as chaves
 * estrangeiras do SQLite só valem com `PRAGMA foreign_keys = ON`, que é
 * desligado por padrão — confiar nisso deixaria notas apontando para uma
 * categoria que não existe mais.
 */
export async function deleteCategory(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE notes SET category_id = NULL WHERE category_id = ?', id);
  await db.runAsync('DELETE FROM categories WHERE id = ?', id);
}
