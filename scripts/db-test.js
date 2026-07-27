/**
 * Testes do banco local.
 *
 * Roda as migrações de verdade num SQLite em memória, em vez de confiar que o
 * SQL está certo por ele compilar — SQL não compila, ele só falha em cima do
 * aparelho de quem instalou.
 *
 * O que mais importa aqui é a MIGRAÇÃO: quem já tem o app instalado tem
 * `user_version = 1` e vai receber a 002 por cima de um banco com dados. Se ela
 * falhar, o app abre com o banco pela metade. Por isso os testes aplicam a 002
 * sobre um banco já povoado, e não sobre um banco vazio.
 *
 * O segundo alvo é a contagem de `?` nos INSERT. Um marcador a menos não é erro
 * de tipo — o TypeScript não conta parâmetros de SQL —, e só aparece como
 * exceção na hora de criar a nota.
 */
const ts = require('typescript');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

// O schema é TypeScript só por causa dos template literals; transpilar é o
// jeito de ler exatamente o SQL que vai para o aparelho, sem copiá-lo aqui.
const src = fs.readFileSync(path.join(__dirname, '../src/database/schema.ts'), 'utf8');
const { outputText } = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const mod = { exports: {} };
new Function('module', 'exports', outputText)(mod, mod.exports);
const { MIGRATION_001_INIT, MIGRATION_002_CATEGORIES } = mod.exports;

let pass = 0;
let fail = 0;
const ok = (n) => { pass++; console.log('  OK   ' + n); };
const bad = (n, d) => { fail++; console.log('  FAIL ' + n + (d ? ' -> ' + d : '')); };

console.log('\nBanco local\n');

/* ------------------------------------------------- as migrações aplicam */
{
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(MIGRATION_001_INIT);
    ok('migração 001 aplica');
  } catch (e) {
    bad('migração 001 falhou', e.message);
  }

  try {
    db.exec(MIGRATION_002_CATEGORIES);
    ok('migração 002 aplica sobre a 001');
  } catch (e) {
    bad('migração 002 falhou', e.message);
  }

  const colunas = db.prepare('PRAGMA table_info(notes)').all().map((c) => c.name);
  if (colunas.includes('category_id')) ok('notes ganhou a coluna category_id');
  else bad('category_id ausente', colunas.join(','));

  const categorias = db.prepare('SELECT * FROM categories ORDER BY position').all();
  if (categorias.length === 4) ok('as quatro categorias iniciais são criadas');
  else bad('categorias iniciais', categorias.length);

  if (categorias[0] && categorias[0].name === 'Aulas') ok('a primeira categoria é Aulas');
  else bad('ordem das categorias iniciais', JSON.stringify(categorias[0]));

  // A cor precisa ser hexadecimal completo: a interface concatena '22' no fim
  // para gerar o fundo translúcido da etiqueta, e um formato curto quebraria.
  const coresValidas = categorias.every((c) => /^#[0-9a-fA-F]{6}$/.test(c.color));
  if (coresValidas) ok('as cores iniciais são hexadecimal de 6 dígitos');
  else bad('cor em formato inesperado', categorias.map((c) => c.color).join(','));
}

/* -------------------------------- a 002 aplica sobre um banco com dados */
{
  const db = new DatabaseSync(':memory:');
  db.exec(MIGRATION_001_INIT);

  // Simula quem já usava o app antes da atualização.
  db.exec(`INSERT INTO notes (id, title, content, is_favorite, is_pinned, is_deleted, created_at, updated_at)
           VALUES ('n1', 'Nota antiga', 'conteudo', 0, 0, 0, 1000, 1000)`);
  db.exec(`INSERT INTO folders (id, name, created_at, updated_at) VALUES ('f1', 'Pasta', 1000, 1000)`);

  try {
    db.exec(MIGRATION_002_CATEGORIES);
    ok('migração 002 aplica sobre banco já povoado');
  } catch (e) {
    bad('002 sobre banco povoado', e.message);
  }

  const nota = db.prepare('SELECT * FROM notes WHERE id = ?').get('n1');
  if (nota && nota.title === 'Nota antiga') ok('a nota anterior sobrevive à migração');
  else bad('nota perdida na migração', JSON.stringify(nota));

  if (nota && nota.category_id === null) ok('nota anterior fica sem categoria, não com lixo');
  else bad('category_id de nota antiga', nota && nota.category_id);
}

/* ------------------------------------------ o INSERT de nota tem os ? certos */
{
  const db = new DatabaseSync(':memory:');
  db.exec(MIGRATION_001_INIT);
  db.exec(MIGRATION_002_CATEGORIES);

  // Exatamente o comando do createNote em notes.service.ts. Um `?` a menos aqui
  // não é erro de tipo: só apareceria como exceção ao criar a primeira nota.
  const sql = `INSERT INTO notes (id, title, content, folder_id, category_id, is_favorite, is_pinned, is_deleted, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?, ?)`;

  try {
    db.prepare(sql).run('n2', 'Titulo', 'Corpo', null, 'cat-aulas', 2000, 2000);
    ok('o INSERT de nota tem a quantidade certa de marcadores');
  } catch (e) {
    bad('INSERT de nota', e.message);
  }

  const nota = db.prepare('SELECT * FROM notes WHERE id = ?').get('n2');
  if (nota && nota.category_id === 'cat-aulas') ok('a categoria é gravada na nota');
  else bad('categoria não gravou', JSON.stringify(nota));
}

/* --------------------------------------------- apagar categoria não some nota */
{
  const db = new DatabaseSync(':memory:');
  db.exec(MIGRATION_001_INIT);
  db.exec(MIGRATION_002_CATEGORIES);
  db.prepare(
    `INSERT INTO notes (id, title, content, folder_id, category_id, is_favorite, is_pinned, is_deleted, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?, ?)`
  ).run('n3', 'Prova de bio', '', null, 'cat-provas', 3000, 3000);

  // Os dois comandos do deleteCategory, na mesma ordem.
  db.prepare('UPDATE notes SET category_id = NULL WHERE category_id = ?').run('cat-provas');
  db.prepare('DELETE FROM categories WHERE id = ?').run('cat-provas');

  const nota = db.prepare('SELECT * FROM notes WHERE id = ?').get('n3');
  if (nota) ok('apagar a categoria não apaga a nota');
  else bad('a nota sumiu junto com a categoria');
  if (nota && nota.category_id === null) ok('a nota volta a ficar sem categoria');
  else bad('nota ficou apontando para categoria apagada', nota && nota.category_id);

  const orfas = db.prepare(
    'SELECT COUNT(*) as total FROM notes n LEFT JOIN categories c ON c.id = n.category_id WHERE n.category_id IS NOT NULL AND c.id IS NULL'
  ).get();
  if (orfas.total === 0) ok('nenhuma nota aponta para categoria inexistente');
  else bad('notas órfãs', orfas.total);
}

/* ------------------------------------------------------- filtro e contagem */
{
  const db = new DatabaseSync(':memory:');
  db.exec(MIGRATION_001_INIT);
  db.exec(MIGRATION_002_CATEGORIES);

  const inserir = db.prepare(
    `INSERT INTO notes (id, title, content, folder_id, category_id, is_favorite, is_pinned, is_deleted, created_at, updated_at)
     VALUES (?, ?, '', NULL, ?, 0, 0, ?, 1000, 1000)`
  );
  inserir.run('a', 'Aula 1', 'cat-aulas', 0);
  inserir.run('b', 'Aula 2', 'cat-aulas', 0);
  inserir.run('c', 'Prova', 'cat-provas', 0);
  inserir.run('d', 'Sem categoria', null, 0);
  inserir.run('e', 'Aula na lixeira', 'cat-aulas', 1);

  const doFiltro = db.prepare(
    'SELECT COUNT(*) as total FROM notes n WHERE n.is_deleted = 0 AND n.category_id = ?'
  ).get('cat-aulas');
  if (doFiltro.total === 2) ok('o filtro por categoria ignora a lixeira');
  else bad('filtro por categoria', doFiltro.total);

  const semCategoria = db.prepare(
    'SELECT COUNT(*) as total FROM notes n WHERE n.is_deleted = 0 AND n.category_id IS NULL'
  ).get();
  if (semCategoria.total === 1) ok('dá para filtrar as notas sem categoria');
  else bad('filtro sem categoria', semCategoria.total);

  // Exatamente a consulta do countNotesByCategory.
  const contagens = db.prepare(
    `SELECT category_id, COUNT(*) as total FROM notes
     WHERE is_deleted = 0 AND category_id IS NOT NULL GROUP BY category_id`
  ).all();
  const mapa = Object.fromEntries(contagens.map((r) => [r.category_id, r.total]));

  if (mapa['cat-aulas'] === 2) ok('a contagem por categoria não conta a lixeira');
  else bad('contagem de aulas', mapa['cat-aulas']);
  if (mapa['cat-trabalhos'] === undefined) ok('categoria sem nota não aparece na contagem');
  else bad('categoria vazia apareceu', mapa['cat-trabalhos']);
}

/* --------------------------------------- posição da categoria nova */
{
  const db = new DatabaseSync(':memory:');
  db.exec(MIGRATION_001_INIT);
  db.exec(MIGRATION_002_CATEGORIES);

  const proxima = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS proxima FROM categories').get();
  if (proxima.proxima === 4) ok('a categoria nova entra no fim da lista');
  else bad('posição da nova categoria', proxima.proxima);

  // Com a tabela vazia, MAX devolve null; sem o COALESCE a posição sairia nula.
  db.exec('DELETE FROM categories');
  const primeira = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS proxima FROM categories').get();
  if (primeira.proxima === 0) ok('a primeira categoria criada recebe posição 0');
  else bad('posição na tabela vazia', primeira.proxima);
}

console.log(`\n${pass} passaram, ${fail} falharam\n`);
process.exit(fail > 0 ? 1 : 0);
