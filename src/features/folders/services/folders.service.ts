import { getDb } from '@/database/client';
import type { Folder } from '@/types';
import { generateId } from '@/utils/id';
import { now } from '@/utils/date';

type FolderRow = {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: number;
  updated_at: number;
};

function mapFolder(row: FolderRow): Folder {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listFolders(): Promise<Folder[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<FolderRow>('SELECT * FROM folders ORDER BY name ASC');
  return rows.map(mapFolder);
}

export async function createFolder(name: string, parentId: string | null = null): Promise<Folder> {
  const db = await getDb();
  const id = generateId();
  const timestamp = now();
  await db.runAsync(
    'INSERT INTO folders (id, name, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    id,
    name,
    parentId,
    timestamp,
    timestamp
  );
  return { id, name, parentId, createdAt: timestamp, updatedAt: timestamp };
}

export async function renameFolder(id: string, name: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE folders SET name = ?, updated_at = ? WHERE id = ?', name, now(), id);
}

export async function deleteFolder(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM folders WHERE id = ?', id);
}
