/**
 * Testes da barra de navegação.
 *
 * A parte que dá para provar é uma só: QUAL ABA ACENDE para cada rota. É lógica
 * de prefixo, e prefixo erra calado — '/friends' sendo roubado por uma aba com
 * prefixo mais curto acende a aba errada, e ninguém abre um chamado por isso.
 * Só acha estranho e desconfia do app.
 *
 * O outro caso que importa é a barra SUMIR onde deve sumir. Dentro de uma nota
 * ou de uma conversa ela roubaria espaço e ofereceria sair de onde a pessoa
 * acabou de entrar.
 */
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(
  path.join(__dirname, '../src/features/navigation/components/NavigationBar.tsx'),
  'utf8'
);

/**
 * O arquivo é um componente e importa meio mundo que só existe dentro do app.
 * Aqui só interessa `abaDaRota` e a tabela `ABAS`, que são dados e aritmética —
 * então os dois são recortados e avaliados sozinhos, sem montar nada.
 */
const trecho =
  src.slice(src.indexOf('const ABAS: Aba[]'), src.indexOf('const ALTURA')) +
  src.slice(src.indexOf('export function abaDaRota'), src.indexOf('export function NavigationBar'));

const { outputText } = ts.transpileModule('type Aba = any;\n' + trecho, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const mod = { exports: {} };
new Function('module', 'exports', outputText)(mod, mod.exports);
const { abaDaRota } = mod.exports;

const NOTAS = 0;
const GRUPOS = 1;
const BUSCAR = 2;
const PERFIL = 3;
const NENHUMA = -1;

let pass = 0;
let fail = 0;
const ok = (n) => { pass++; console.log('  OK   ' + n); };
const bad = (n, d) => { fail++; console.log('  FAIL ' + n + (d !== undefined ? ' -> ' + d : '')); };

console.log('\nBarra de navegação\n');

const casos = [
  // a raiz é caso à parte: como prefixo, '/' casaria com o app inteiro
  ['/', NOTAS, 'a raiz acende Notas'],
  ['', NOTAS, 'caminho vazio acende Notas'],

  // telas de dentro pertencem à aba de onde vieram
  ['/favorites', NOTAS, 'favoritos ficam em Notas'],
  ['/trash', NOTAS, 'a lixeira fica em Notas'],
  ['/folder/abc', NOTAS, 'uma pasta específica fica em Notas'],
  ['/tag/prova', NOTAS, 'uma tag específica fica em Notas'],

  ['/groups', GRUPOS, 'a lista de grupos acende Grupos'],
  ['/groups/123', GRUPOS, 'a capa de um grupo fica em Grupos'],
  ['/groups/123/feed', GRUPOS, 'o mural do grupo fica em Grupos'],
  ['/groups/123/members', GRUPOS, 'os membros ficam em Grupos'],

  ['/search', BUSCAR, 'a busca acende Buscar'],

  ['/profile', PERFIL, 'o perfil acende Perfil'],
  ['/settings', PERFIL, 'os ajustes ficam em Perfil'],
  ['/u/abc', PERFIL, 'o perfil de outra pessoa fica em Perfil'],

  // Este é o caso que o prefixo erra com facilidade: '/friends' e '/folder'
  // começam com 'f', e '/friends/add' é uma tela de dentro.
  ['/friends', PERFIL, 'amigos ficam em Perfil, não em Notas'],
  ['/friends/add', PERFIL, 'adicionar amigo fica em Perfil'],
];

for (const [rota, esperada, descricao] of casos) {
  const obtida = abaDaRota(rota);
  if (obtida === esperada) ok(descricao);
  else bad(descricao, `rota "${rota}" acendeu ${obtida}, esperava ${esperada}`);
}

/* --------------------------------- onde a barra não pode aparecer */
{
  // Dentro de uma nota, de uma conversa ou de um post, a barra some. São telas
  // de trabalho: quem entrou ali quer o conteúdo, não um convite para sair.
  const semBarra = [
    ['/note/abc', 'dentro de uma nota'],
    ['/groups/1/room/2', 'dentro de uma conversa'],
    ['/groups/1/post/2', 'dentro de um post'],
    ['/login', 'na tela de entrar'],
    ['/upgrade', 'na tela de assinatura'],
    ['/diagnostics', 'no diagnóstico'],
  ];

  const errados = [];
  for (const [rota, onde] of semBarra) {
    if (abaDaRota(rota) !== NENHUMA) errados.push(`${onde} (${rota} -> ${abaDaRota(rota)})`);
  }
  if (errados.length === 0) ok('a barra some nas telas de trabalho e nas de fora do app');
  else bad('a barra apareceu onde não devia', errados.join('; '));
}

/* ---------------------------------------------- rota desconhecida */
{
  // Rota que ninguém previu não pode acender uma aba ao acaso — some, que é o
  // comportamento seguro.
  if (abaDaRota('/qualquer-coisa-nova') === NENHUMA) ok('rota desconhecida não acende aba nenhuma');
  else bad('rota desconhecida acendeu', abaDaRota('/qualquer-coisa-nova'));

  if (abaDaRota('/groupsfalso') === NENHUMA) ok('prefixo parecido não conta como a aba');
  else bad('"/groupsfalso" foi confundido com "/groups"');
}

console.log(`\n${pass} passaram, ${fail} falharam\n`);
process.exit(fail > 0 ? 1 : 0);
