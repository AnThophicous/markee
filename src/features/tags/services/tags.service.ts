import { getDb } from '@/database/client';

export type TagWithCount = { id: string; name: string; noteCount: number };

export async function listTags(): Promise<TagWithCount[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; name: string; note_count: number }>(
    `SELECT t.id as id, t.name as name, COUNT(nt.note_id) as note_count
     FROM tags t
     LEFT JOIN note_tags nt ON nt.tag_id = t.id
     LEFT JOIN notes n ON n.id = nt.note_id AND n.is_deleted = 0
     GROUP BY t.id
     HAVING note_count > 0
     ORDER BY t.name ASC`
  );
  return rows.map((row) => ({ id: row.id, name: row.name, noteCount: row.note_count }));
}
