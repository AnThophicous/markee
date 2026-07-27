/**
 * Testes da geometria dos gráficos.
 *
 * O alvo é NaN. Toda divisão aqui tem denominador que pode ser zero — todos os
 * valores iguais, total zero, um ponto só, lista vazia — e um NaN entra na
 * string do caminho SVG como "L NaN NaN". No Android isso não lança erro: o
 * desenho simplesmente não aparece. Defeito invisível é o mais caro de achar,
 * então cada caso degenerado tem teste.
 */
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../src/features/editor/utils/chart-math.ts'), 'utf8');
const { outputText } = ts.transpileModule(src.replace(/^import type[\s\S]*?;$/gm, ''), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const mod = { exports: {} };
new Function('module', 'exports', outputText)(mod, mod.exports);
const { escalaDeBarras, coordenadasDaLinha, fatiasDaPizza } = mod.exports;

let pass = 0;
let fail = 0;
const ok = (n) => { pass++; console.log('  OK   ' + n); };
const bad = (n, d) => { fail++; console.log('  FAIL ' + n + (d ? ' -> ' + d : '')); };

const p = (rotulo, valor) => ({ rotulo, valor });

/** Nenhum número da estrutura pode ser NaN ou infinito. */
function todosFinitos(objeto) {
  const restantes = [objeto];
  while (restantes.length > 0) {
    const atual = restantes.pop();
    if (typeof atual === 'number' && !Number.isFinite(atual)) return false;
    if (typeof atual === 'string' && /NaN|Infinity|undefined/.test(atual)) return false;
    if (atual && typeof atual === 'object') restantes.push(...Object.values(atual));
  }
  return true;
}

console.log('\nGeometria dos gráficos\n');

/* ------------------------------------------------------------- escala das barras */
{
  const casos = [
    ['lista vazia', []],
    ['todos zero', [p('a', 0), p('b', 0)]],
    ['um ponto só', [p('a', 5)]],
    ['negativos', [p('a', -3), p('b', -9)]],
    ['misto', [p('a', -3), p('b', 9)]],
    ['valor não numérico', [p('a', 'muito'), p('b', 4)]],
    ['valor nulo', [p('a', null), p('b', null)]],
  ];

  for (const [rotulo, pontos] of casos) {
    const escala = escalaDeBarras(pontos);
    if (Number.isFinite(escala) && escala > 0) ok('escala segura: ' + rotulo);
    else bad('escala inválida: ' + rotulo, escala);
  }

  if (escalaDeBarras([p('a', -3), p('b', -9)]) === 9) ok('escala usa o maior valor absoluto');
  else bad('escala com negativos', escalaDeBarras([p('a', -3), p('b', -9)]));
}

/* ------------------------------------------------------------------ linha */
{
  const casos = [
    ['lista vazia', []],
    ['um ponto', [p('a', 5)]],
    ['todos iguais', [p('a', 7), p('b', 7), p('c', 7)]],
    ['todos zero', [p('a', 0), p('b', 0)]],
    ['negativos', [p('a', -5), p('b', -1)]],
    ['valores não numéricos', [p('a', 'x'), p('b', 3)]],
    ['muitos pontos', Array.from({ length: 50 }, (_, i) => p('p' + i, i))],
  ];

  for (const [rotulo, pontos] of casos) {
    const coords = coordenadasDaLinha(pontos, 300, 140, 10);
    if (!todosFinitos(coords)) { bad('linha produziu NaN: ' + rotulo, JSON.stringify(coords).slice(0, 120)); continue; }
    if (coords.length !== pontos.length) { bad('linha perdeu pontos: ' + rotulo, coords.length); continue; }
    ok('linha sem NaN: ' + rotulo);
  }

  // Largura absurda não pode produzir coordenada fora do desenho.
  for (const largura of [0, 1, -50]) {
    const coords = coordenadasDaLinha([p('a', 1), p('b', 2)], largura, 140, 10);
    if (todosFinitos(coords)) ok('linha tolera largura ' + largura);
    else bad('linha com largura ' + largura, JSON.stringify(coords));
  }

  // O maior valor tem que ficar mais alto (y menor) que o menor.
  const c = coordenadasDaLinha([p('baixo', 1), p('alto', 10)], 300, 140, 10);
  if (c[1].y < c[0].y) ok('valor maior fica mais alto no desenho');
  else bad('eixo y invertido', JSON.stringify(c));
}

/* ------------------------------------------------------------------ pizza */
{
  const casos = [
    ['lista vazia', []],
    ['todos zero', [p('a', 0), p('b', 0)]],
    ['todos negativos', [p('a', -1), p('b', -2)]],
    ['uma fatia só', [p('tudo', 10)]],
    ['duas fatias', [p('a', 1), p('b', 1)]],
    ['muitas fatias', Array.from({ length: 20 }, (_, i) => p('f' + i, i + 1))],
    ['valores não numéricos', [p('a', 'x'), p('b', 5)]],
    ['um valor gigante', [p('a', 1e12), p('b', 1)]],
  ];

  for (const [rotulo, pontos] of casos) {
    const fatias = fatiasDaPizza(pontos, 6, 75, 71);
    if (!todosFinitos(fatias)) { bad('pizza produziu NaN: ' + rotulo, JSON.stringify(fatias).slice(0, 140)); continue; }
    ok('pizza sem NaN: ' + rotulo);
  }

  // Total zero não deve gerar fatia nenhuma, em vez de fatias de ângulo indefinido.
  if (fatiasDaPizza([p('a', 0)], 6, 75, 71).length === 0) ok('total zero não gera fatia');
  else bad('total zero gerou fatia');

  // Uma fatia só ocupa o círculo inteiro e precisa ser sinalizada, senão o arco
  // colapsa e o gráfico some.
  const unica = fatiasDaPizza([p('tudo', 10)], 6, 75, 71);
  if (unica.length === 1 && unica[0].circuloInteiro === true) ok('fatia de 100% é marcada como círculo inteiro');
  else bad('fatia de 100%', JSON.stringify(unica));

  // Duas fatias iguais não podem ser marcadas como círculo inteiro.
  const duas = fatiasDaPizza([p('a', 1), p('b', 1)], 6, 75, 71);
  if (duas.every((f) => !f.circuloInteiro)) ok('meia fatia não vira círculo inteiro');
  else bad('meia fatia marcada como círculo');

  // As proporções têm que somar 1.
  const soma = fatiasDaPizza([p('a', 3), p('b', 5), p('c', 2)], 6, 75, 71)
    .reduce((t, f) => t + f.proporcao, 0);
  if (Math.abs(soma - 1) < 1e-9) ok('as proporções somam 100%'); else bad('proporções não somam 1', soma);

  // Acima do limite, o excedente vira "Outros" em vez de ganhar cor nova.
  const muitas = fatiasDaPizza(Array.from({ length: 20 }, (_, i) => p('f' + i, 1)), 6, 75, 71);
  if (muitas.length === 7) ok('excedente é agrupado em uma fatia só'); else bad('agrupamento', muitas.length);
  if (muitas[6].rotulo === 'Outros') ok('a fatia agrupada se chama Outros'); else bad('rótulo do agrupamento', muitas[6].rotulo);
  if (muitas[6].valor === 14) ok('Outros soma o valor de todo o excedente'); else bad('soma de Outros', muitas[6].valor);

  // O caminho SVG tem que ser desenhável.
  const caminho = fatiasDaPizza([p('a', 3), p('b', 1)], 6, 75, 71)[0].caminho;
  if (/^M 75 75 L [-\d.]+ [-\d.]+ A 71 71 0 [01] 1 [-\d.]+ [-\d.]+ Z$/.test(caminho)) ok('o caminho SVG tem forma válida');
  else bad('caminho SVG malformado', caminho);

  // Fatia maior que meio círculo precisa do sinalizador de arco grande, senão o
  // desenho sai pelo lado curto e a fatia aparece invertida.
  const grande = fatiasDaPizza([p('a', 9), p('b', 1)], 6, 75, 71)[0];
  if (grande.caminho.includes('A 71 71 0 1 1')) ok('fatia maior que meio círculo usa arco grande');
  else bad('arco grande ausente', grande.caminho);

  const pequena = fatiasDaPizza([p('a', 1), p('b', 9)], 6, 75, 71)[0];
  if (pequena.caminho.includes('A 71 71 0 0 1')) ok('fatia menor que meio círculo usa arco pequeno');
  else bad('arco pequeno ausente', pequena.caminho);
}

/* ------------------------------------------- entradas malformadas não lançam */
{
  const lixo = [null, undefined, {}, { rotulo: 'a' }, { valor: 3 }];
  try {
    const f = fatiasDaPizza(lixo, 6, 75, 71);
    const c = coordenadasDaLinha(lixo, 300, 140, 10);
    const e = escalaDeBarras(lixo);
    if (todosFinitos(f) && todosFinitos(c) && Number.isFinite(e)) ok('entrada malformada não gera NaN');
    else bad('entrada malformada gerou NaN', JSON.stringify({ f, c, e }).slice(0, 160));
  } catch (erro) {
    bad('entrada malformada lançou', erro.message);
  }
}

console.log(`\n${pass} passaram, ${fail} falharam\n`);
process.exit(fail > 0 ? 1 : 0);
