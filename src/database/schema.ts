export const MIGRATION_001_INIT = `
CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  is_pinned INTEGER NOT NULL DEFAULT 0,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_folder ON notes(folder_id);
CREATE INDEX IF NOT EXISTS idx_notes_deleted ON notes(is_deleted);
CREATE INDEX IF NOT EXISTS idx_notes_favorite ON notes(is_favorite);
CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(is_pinned);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS note_tags (
  note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_note_tags_tag ON note_tags(tag_id);

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL,
  trigger_at INTEGER,
  repeat_hour INTEGER,
  repeat_minute INTEGER,
  repeat_weekday INTEGER,
  notification_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reminders_note ON reminders(note_id);

CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  note_id UNINDEXED,
  title,
  body
);
`;

/**
 * Categorias.
 *
 * Pastas já existiam, mas servem para arquivar: uma nota mora em uma pasta e
 * some da vista. Categoria é o oposto — é uma etiqueta grande e colorida que
 * aparece na lista e serve para filtrar de relance ("mostra só as provas").
 * Por isso é uma coluna na nota, e não outra árvore de pastas.
 *
 * As cores vêm da mesma paleta usada nos gráficos, que foi conferida com
 * validador: são distinguíveis inclusive por quem enxerga cores de forma
 * diferente. Não é rigor à toa — a cor da categoria é o que se procura
 * correndo o olho pela lista, então ela precisa funcionar para todo mundo.
 *
 * As quatro categorias iniciais existem para a função ser descoberta. Uma tela
 * vazia com um botão "criar categoria" é ignorada; quatro etiquetas prontas
 * mostram para que serve na primeira olhada. Podem ser renomeadas ou apagadas.
 */
export const MIGRATION_002_CATEGORIES = `
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  icon TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

ALTER TABLE notes ADD COLUMN category_id TEXT REFERENCES categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notes_category ON notes(category_id);

INSERT INTO categories (id, name, color, icon, position, created_at) VALUES
  ('cat-aulas',     'Aulas',     '#2a78d6', 'book-open',  0, strftime('%s','now') * 1000),
  ('cat-provas',    'Provas',    '#eb6834', 'edit-3',     1, strftime('%s','now') * 1000),
  ('cat-trabalhos', 'Trabalhos', '#1baf7a', 'briefcase',  2, strftime('%s','now') * 1000),
  ('cat-pessoal',   'Pessoal',   '#4a3aa7', 'heart',      3, strftime('%s','now') * 1000);
`;
