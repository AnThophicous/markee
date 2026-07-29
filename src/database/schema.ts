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

/**
 * Capa e emoji da nota.
 *
 * A categoria já diz a que assunto a nota pertence; isto é outra coisa — é a
 * nota ter cara própria. Numa lista de trinta notas de "Aulas", todas com a
 * mesma etiqueta azul, o que faz achar a certa é o 🧪 na frente de uma e o 📐 na
 * frente da outra.
 *
 * As duas colunas nascem nulas, e nulo quer dizer "como sempre foi". Nada muda
 * de aparência para quem já usa o app até a pessoa escolher.
 *
 * Não há CHECK no formato da cor. É banco local, no aparelho de quem escreveu —
 * validar aqui protegeria a pessoa dela mesma, e o custo de uma migração que
 * falha em campo é o app abrir com o banco pela metade. A interface só oferece
 * cores de uma lista fixa.
 */
export const MIGRATION_003_NOTE_LOOK = `
ALTER TABLE notes ADD COLUMN cover_color TEXT;
ALTER TABLE notes ADD COLUMN emoji TEXT;
`;

/**
 * Cartas de revisão.
 *
 * Uma carta nasce de um trecho da nota: o que estava escrito vira pergunta, e a
 * resposta é o que a pessoa precisa lembrar. A nota continua sendo a fonte —
 * apagar a nota apaga as cartas dela, por isso o ON DELETE CASCADE.
 *
 * A facilidade é INTEIRO, em milésimos. Guardar 2.5 como REAL parece mais
 * natural e é pior: a facilidade multiplica a si mesma a cada revisão, então o
 * erro de ponto flutuante não fica pequeno, ele compõe. Depois de um ano de uso
 * dois aparelhos com a mesma resposta chegariam a datas diferentes.
 *
 * `card_reviews` guarda toda revisão respondida, e não só o estado atual da
 * carta. É o que permite dizer "você revisou 40 cartas essa semana" sem chutar
 * — e o estado da carta, sozinho, não sabe contar o próprio passado.
 */
export const MIGRATION_004_REVIEW = `
CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  repetitions INTEGER NOT NULL DEFAULT 0,
  interval_days INTEGER NOT NULL DEFAULT 0,
  ease INTEGER NOT NULL DEFAULT 2500,
  lapses INTEGER NOT NULL DEFAULT 0,
  due_at INTEGER NOT NULL,
  suspended INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cards_due ON cards(due_at);
CREATE INDEX IF NOT EXISTS idx_cards_note ON cards(note_id);

CREATE TABLE IF NOT EXISTS card_reviews (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  interval_days INTEGER NOT NULL,
  reviewed_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_card_reviews_when ON card_reviews(reviewed_at);
CREATE INDEX IF NOT EXISTS idx_card_reviews_card ON card_reviews(card_id);
`;

/**
 * Dias de estudo, para a ofensiva.
 *
 * Poderia ser calculado varrendo notas e revisões, e essa foi a primeira ideia.
 * Não serve: "estudou hoje" inclui escrever nota, revisar carta e gravar aula,
 * três tabelas diferentes, e a ofensiva é lida na abertura do app — varrer três
 * tabelas inteiras para desenhar um número na tela inicial fica lento
 * exatamente para quem mais usa o app.
 *
 * Uma linha por dia, com a data em texto AAAA-MM-DD e não em milissegundos: a
 * ofensiva é sobre o dia do calendário de quem estuda, e o mesmo instante cai
 * em dias diferentes dependendo do fuso. Texto grava o dia que a pessoa viu.
 */
export const MIGRATION_005_STREAK = `
CREATE TABLE IF NOT EXISTS study_days (
  day TEXT PRIMARY KEY,
  notes_written INTEGER NOT NULL DEFAULT 0,
  cards_reviewed INTEGER NOT NULL DEFAULT 0,
  minutes_recorded INTEGER NOT NULL DEFAULT 0
);
`;
