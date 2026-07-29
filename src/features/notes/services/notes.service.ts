import type { SQLiteDatabase } from 'expo-sqlite';

import { getDb } from '@/database/client';
import type { Note, NoteWithTags } from '@/types';
import { generateId } from '@/utils/id';
import { now } from '@/utils/date';
import { extractHashtags, stripMarkdown } from '@/utils/text';
import { registrarNota } from '@/features/stats/services/study-days.service';

type NoteRow = {
  id: string;
  title: string;
  content: string;
  folder_id: string | null;
  category_id: string | null;
  cover_color: string | null;
  emoji: string | null;
  is_favorite: number;
  is_pinned: number;
  is_deleted: number;
  deleted_at: number | null;
  created_at: number;
  updated_at: number;
};

function mapNote(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    folderId: row.folder_id,
    categoryId: row.category_id,
    coverColor: row.cover_color,
    emoji: row.emoji,
    isFavorite: row.is_favorite === 1,
    isPinned: row.is_pinned === 1,
    isDeleted: row.is_deleted === 1,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function attachTags(db: SQLiteDatabase, notes: Note[]): Promise<NoteWithTags[]> {
  if (notes.length === 0) return [];
  const ids = notes.map((note) => note.id);
  const placeholders = ids.map(() => '?').join(',');
  const rows = await db.getAllAsync<{ note_id: string; name: string }>(
    `SELECT nt.note_id as note_id, t.name as name
     FROM note_tags nt JOIN tags t ON t.id = nt.tag_id
     WHERE nt.note_id IN (${placeholders})`,
    ids
  );
  const tagsByNote = new Map<string, string[]>();
  for (const row of rows) {
    const list = tagsByNote.get(row.note_id) ?? [];
    list.push(row.name);
    tagsByNote.set(row.note_id, list);
  }
  return notes.map((note) => ({ ...note, tags: tagsByNote.get(note.id) ?? [] }));
}

async function syncNoteFts(db: SQLiteDatabase, noteId: string, title: string, content: string) {
  await db.runAsync('DELETE FROM notes_fts WHERE note_id = ?', noteId);
  await db.runAsync(
    'INSERT INTO notes_fts (note_id, title, body) VALUES (?, ?, ?)',
    noteId,
    title,
    stripMarkdown(content)
  );
}

async function syncNoteTags(db: SQLiteDatabase, noteId: string, content: string) {
  const tagNames = extractHashtags(content);
  await db.runAsync('DELETE FROM note_tags WHERE note_id = ?', noteId);
  for (const name of tagNames) {
    let tag = await db.getFirstAsync<{ id: string }>('SELECT id FROM tags WHERE name = ?', name);
    if (!tag) {
      const id = generateId();
      await db.runAsync('INSERT INTO tags (id, name) VALUES (?, ?)', id, name);
      tag = { id };
    }
    await db.runAsync('INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)', noteId, tag.id);
  }
}

export type NoteFilter = {
  folderId?: string | null;
  categoryId?: string | null;
  favoritesOnly?: boolean;
  trashed?: boolean;
  tagName?: string;
};

export async function listNotes(filter: NoteFilter = {}): Promise<NoteWithTags[]> {
  const db = await getDb();
  const whereClauses = [filter.trashed ? 'n.is_deleted = 1' : 'n.is_deleted = 0'];
  const whereParams: (string | number)[] = [];
  let joinSql = '';
  const joinParams: string[] = [];

  if (filter.folderId !== undefined) {
    if (filter.folderId === null) {
      whereClauses.push('n.folder_id IS NULL');
    } else {
      whereClauses.push('n.folder_id = ?');
      whereParams.push(filter.folderId);
    }
  }

  if (filter.categoryId !== undefined) {
    if (filter.categoryId === null) {
      whereClauses.push('n.category_id IS NULL');
    } else {
      whereClauses.push('n.category_id = ?');
      whereParams.push(filter.categoryId);
    }
  }

  if (filter.favoritesOnly) {
    whereClauses.push('n.is_favorite = 1');
  }

  if (filter.tagName) {
    joinSql = 'JOIN note_tags nt ON nt.note_id = n.id JOIN tags t ON t.id = nt.tag_id AND t.name = ?';
    joinParams.push(filter.tagName);
  }

  const rows = await db.getAllAsync<NoteRow>(
    `SELECT n.* FROM notes n
     ${joinSql}
     WHERE ${whereClauses.join(' AND ')}
     ORDER BY n.is_pinned DESC, n.updated_at DESC`,
    [...joinParams, ...whereParams]
  );

  return attachTags(db, rows.map(mapNote));
}

export async function getNote(id: string): Promise<NoteWithTags | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<NoteRow>('SELECT * FROM notes WHERE id = ?', id);
  if (!row) return null;
  const [withTags] = await attachTags(db, [mapNote(row)]);
  return withTags;
}

export async function createNote(
  initial: { folderId?: string | null; categoryId?: string | null; title?: string; content?: string } = {}
): Promise<NoteWithTags> {
  const db = await getDb();
  const id = generateId();
  const timestamp = now();
  const title = initial.title ?? '';
  const content = initial.content ?? '';

  await db.runAsync(
    `INSERT INTO notes (id, title, content, folder_id, category_id, is_favorite, is_pinned, is_deleted, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?, ?)`,
    id,
    title,
    content,
    initial.folderId ?? null,
    initial.categoryId ?? null,
    timestamp,
    timestamp
  );
  await syncNoteFts(db, id, title, content);
  // A ofensiva conta escrever nota como estudo. Registrar na CRIAÇÃO e não a
  // cada salvamento é de propósito: o salvamento automático dispara a cada
  // 600ms enquanto se digita, e contar ali faria uma aula render trezentas
  // "atividades" — o mapa de calor ficaria todo no tom máximo e pararia de
  // dizer qualquer coisa.
  await registrarNota();
  return {
    id,
    title,
    content,
    folderId: initial.folderId ?? null,
    categoryId: initial.categoryId ?? null,
    coverColor: null,
    emoji: null,
    isFavorite: false,
    isPinned: false,
    isDeleted: false,
    deletedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    tags: [],
  };
}

export type NotePatch = Partial<
  Pick<
    Note,
    'title' | 'content' | 'folderId' | 'categoryId' | 'coverColor' | 'emoji' | 'isFavorite' | 'isPinned'
  >
>;

export async function updateNote(id: string, patch: NotePatch): Promise<NoteWithTags> {
  const db = await getDb();
  const sets: string[] = ['updated_at = ?'];
  const params: (string | number | null)[] = [now()];

  if (patch.title !== undefined) {
    sets.push('title = ?');
    params.push(patch.title);
  }
  if (patch.content !== undefined) {
    sets.push('content = ?');
    params.push(patch.content);
  }
  if (patch.categoryId !== undefined) {
    sets.push('category_id = ?');
    params.push(patch.categoryId);
  }

  if (patch.folderId !== undefined) {
    sets.push('folder_id = ?');
    params.push(patch.folderId);
  }
  // Nulo aqui quer dizer "tirar a capa" / "tirar o emoji", e por isso passa
  // direto em vez de virar `|| null`: o `undefined` é que significa não mexer.
  if (patch.coverColor !== undefined) {
    sets.push('cover_color = ?');
    params.push(patch.coverColor);
  }
  if (patch.emoji !== undefined) {
    sets.push('emoji = ?');
    params.push(patch.emoji);
  }
  if (patch.isFavorite !== undefined) {
    sets.push('is_favorite = ?');
    params.push(patch.isFavorite ? 1 : 0);
  }
  if (patch.isPinned !== undefined) {
    sets.push('is_pinned = ?');
    params.push(patch.isPinned ? 1 : 0);
  }

  params.push(id);
  await db.runAsync(`UPDATE notes SET ${sets.join(', ')} WHERE id = ?`, params);

  const row = await db.getFirstAsync<NoteRow>('SELECT * FROM notes WHERE id = ?', id);
  if (!row) throw new Error('Note not found');

  if (patch.title !== undefined || patch.content !== undefined) {
    await syncNoteFts(db, row.id, row.title, row.content);
    await syncNoteTags(db, row.id, row.content);
  }

  const [withTags] = await attachTags(db, [mapNote(row)]);
  return withTags;
}

export async function softDeleteNote(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE notes SET is_deleted = 1, deleted_at = ? WHERE id = ?', now(), id);
}

export async function restoreNote(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE notes SET is_deleted = 0, deleted_at = NULL WHERE id = ?', id);
}

export async function permanentlyDeleteNote(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM notes_fts WHERE note_id = ?', id);
  await db.runAsync('DELETE FROM notes WHERE id = ?', id);
}

export async function emptyTrash(): Promise<void> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string }>('SELECT id FROM notes WHERE is_deleted = 1');
  for (const row of rows) {
    await db.runAsync('DELETE FROM notes_fts WHERE note_id = ?', row.id);
  }
  await db.runAsync('DELETE FROM notes WHERE is_deleted = 1');
}

function buildFtsQuery(raw: string): string {
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return '';
  return tokens.map((token) => `"${token.replace(/"/g, '')}"*`).join(' ');
}

export async function searchNotes(query: string, filter: { tagName?: string; folderId?: string } = {}): Promise<NoteWithTags[]> {
  const ftsQuery = buildFtsQuery(query);
  if (!ftsQuery) return [];

  const db = await getDb();
  const whereClauses = ['n.is_deleted = 0', 'f MATCH ?'];
  const whereParams: string[] = [ftsQuery];
  let joinSql = '';
  const joinParams: string[] = [];

  if (filter.tagName) {
    joinSql = 'JOIN note_tags nt ON nt.note_id = n.id JOIN tags t ON t.id = nt.tag_id AND t.name = ?';
    joinParams.push(filter.tagName);
  }

  if (filter.folderId) {
    whereClauses.push('n.folder_id = ?');
    whereParams.push(filter.folderId);
  }

  const rows = await db.getAllAsync<NoteRow>(
    `SELECT n.* FROM notes n
     JOIN notes_fts f ON f.note_id = n.id
     ${joinSql}
     WHERE ${whereClauses.join(' AND ')}
     ORDER BY n.is_pinned DESC, n.updated_at DESC`,
    [...joinParams, ...whereParams]
  );

  return attachTags(db, rows.map(mapNote));
}
