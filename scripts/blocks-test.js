/**
 * Testes da conversão entre markdown e blocos.
 *
 * A propriedade central é ESTABILIDADE: abrir a nota e fechar sem tocar em nada
 * não pode alterar o texto. Se a ida e volta não for estável, a nota muda
 * sozinha a cada abertura, o salvamento automático grava a mudança, e em poucas
 * aberturas o conteúdo derrete. É um estrago silencioso e irreversível, por isso
 * é o que mais tem teste aqui.
 *
 * A segunda propriedade é NÃO PERDER CONTEÚDO: qualquer texto que entrou tem
 * que sair. Um bloco que o editor não entende deve degradar para algo visível,
 * nunca sumir.
 */
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

function carregar(arquivoRelativo, injecoes = {}) {
  const src = fs.readFileSync(path.join(__dirname, arquivoRelativo), 'utf8');
  const semImports = src.replace(/^import[\s\S]*?from '[^']+';$/gm, '');

  const { outputText } = ts.transpileModule(semImports, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });

  const nomes = Object.keys(injecoes);
  const mod = { exports: {} };
  new Function('module', 'exports', ...nomes, outputText)(mod, mod.exports, ...nomes.map((n) => injecoes[n]));
  return mod.exports;
}

const parser = carregar('../src/features/editor/utils/markdown-parser.ts');
const M = carregar('../src/features/editor/model/blocks.ts', { parseMarkdown: parser.parseMarkdown });

const { paraBlocos, paraMarkdown, criarBloco } = M;

let pass = 0;
let fail = 0;
const ok = (n) => { pass++; console.log('  OK   ' + n); };
const bad = (n, d) => { fail++; console.log('  FAIL ' + n + (d ? '\n         ' + String(d).replace(/\n/g, '\n         ') : '')); };

/** markdown -> blocos -> markdown */
const voltaEMeia = (md) => paraMarkdown(paraBlocos(md));

console.log('\nConversão entre markdown e blocos\n');

/* ------------------------------------------------------- estabilidade */
{
  const exemplos = {
    'título': '# Prova de História',
    'subtítulo': '## Capítulo 2',
    'parágrafo': 'Texto solto qualquer.',
    'lista': '- primeiro\n- segundo',
    'numerada': '1. um\n2. dois\n3. três',
    'tarefa': '- [ ] estudar\n- [x] revisar',
    'citação': '> alguém disse isso',
    'divisor': '---',
    'código': '```\nconst x = 1;\n```',
    'imagem': '![foto](https://exemplo.com/a.png)',
    'tudo junto':
      '# Título\n' +
      'Um parágrafo.\n' +
      '## Sub\n' +
      '- a\n- b\n' +
      '1. um\n2. dois\n' +
      '- [x] feito\n' +
      '> citação\n' +
      '---\n' +
      '```\ncodigo()\n```',
  };

  for (const [rotulo, md] of Object.entries(exemplos)) {
    const uma = voltaEMeia(md);
    const duas = voltaEMeia(uma);
    if (uma === duas) ok('estável: ' + rotulo);
    else bad('INSTÁVEL: ' + rotulo, 'primeira: ' + JSON.stringify(uma) + '\nsegunda:  ' + JSON.stringify(duas));
  }
}

/* --------------------------------------- estabilidade com o texto original */
{
  // Estes já estão na forma canônica, então a primeira volta não deve mudá-los.
  const canonicos = [
    '# Título',
    '- a\n- b',
    '- [ ] tarefa',
    '> citação',
    '1. um\n2. dois',
    'parágrafo comum',
  ];

  let todosIguais = true;
  const diferentes = [];
  for (const md of canonicos) {
    const saida = voltaEMeia(md);
    if (saida !== md) {
      todosIguais = false;
      diferentes.push(JSON.stringify(md) + ' -> ' + JSON.stringify(saida));
    }
  }
  if (todosIguais) ok('texto já canônico atravessa sem alteração');
  else bad('texto canônico foi alterado', diferentes.join('\n'));
}

/* --------------------------------------------------------- tipos corretos */
{
  const b = paraBlocos('# T\n## S\n- l\n1. n\n- [x] t\n> c\n---\ntexto');
  const tipos = b.map((x) => x.tipo).join(',');
  const esperado = 'titulo,subtitulo,lista,numerada,tarefa,citacao,divisor,texto';
  if (tipos === esperado) ok('cada linha vira o tipo certo');
  else bad('tipos errados', tipos + '\nesperado: ' + esperado);

  const tarefa = b.find((x) => x.tipo === 'tarefa');
  if (tarefa && tarefa.marcado === true) ok('tarefa marcada é reconhecida'); else bad('tarefa marcada');
}

/* ------------------------------------------------- título nível 3 não some */
{
  const b = paraBlocos('### Terceiro nível');
  if (b[0].tipo === 'subtitulo' && b[0].texto === 'Terceiro nível') ok('título nível 3 vira subtítulo, não parágrafo');
  else bad('título nível 3', JSON.stringify(b[0]));
}

/* ------------------------------------------------------ numeração reinicia */
{
  const md = paraMarkdown([
    criarBloco('numerada', 'a'),
    criarBloco('numerada', 'b'),
    criarBloco('texto', 'corta'),
    criarBloco('numerada', 'c'),
  ]);
  if (md === '1. a\n2. b\ncorta\n1. c') ok('numeração reinicia depois de outro bloco');
  else bad('numeração não reiniciou', JSON.stringify(md));
}

/* ------------------------------------------------------------- gráfico */
{
  const md = '```grafico\n{"tipo":"barra","titulo":"Notas","dados":[{"rotulo":"Mat","valor":8},{"rotulo":"Port","valor":7}]}\n```';
  const b = paraBlocos(md);

  if (b[0].tipo === 'grafico') ok('gráfico é reconhecido'); else bad('gráfico não reconhecido', b[0].tipo);
  if (b[0].grafico && b[0].grafico.dados.length === 2) ok('lê os pontos do gráfico'); else bad('pontos do gráfico');
  if (b[0].grafico && b[0].grafico.dados[0].valor === 8) ok('lê o valor numérico'); else bad('valor numérico');

  const uma = voltaEMeia(md);
  const duas = voltaEMeia(uma);
  if (uma === duas) ok('gráfico é estável na ida e volta'); else bad('gráfico instável', uma + '\n' + duas);
}

/* -------------------------------------------- gráfico com JSON estragado */
{
  const md = '```grafico\n{isso não é json\n```';
  const b = paraBlocos(md);

  if (b[0].tipo === 'codigo') ok('gráfico quebrado vira bloco de código');
  else bad('gráfico quebrado', b[0].tipo);
  if (b[0].texto.includes('isso não é json')) ok('o conteúdo do gráfico quebrado não é perdido');
  else bad('conteúdo perdido', JSON.stringify(b[0].texto));
}

/* ------------------------------------- gráfico com valores absurdos */
{
  const casos = [
    ['valor de texto', '{"tipo":"barra","dados":[{"rotulo":"a","valor":"muito"}]}'],
    ['valor nulo', '{"tipo":"barra","dados":[{"rotulo":"a","valor":null}]}'],
    ['sem dados', '{"tipo":"barra"}'],
    ['dados não é lista', '{"tipo":"barra","dados":"nada"}'],
    ['tipo inventado', '{"tipo":"holograma","dados":[]}'],
    ['ponto nulo na lista', '{"tipo":"barra","dados":[null,{"rotulo":"a","valor":1}]}'],
  ];

  for (const [rotulo, json] of casos) {
    const b = paraBlocos('```grafico\n' + json + '\n```');
    const g = b[0].grafico;
    if (!g) { bad('gráfico ' + rotulo + ' virou nada', b[0].tipo); continue; }

    const numerosOk = g.dados.every((p) => Number.isFinite(p.valor));
    const tipoOk = ['barra', 'linha', 'pizza'].includes(g.tipo);
    if (numerosOk && tipoOk) ok('gráfico tolera ' + rotulo);
    else bad('gráfico não tolera ' + rotulo, JSON.stringify(g));
  }
}

/* --------------------------------------------------------------- tabela */
{
  const md = '| a | b |\n| --- | --- |\n| 1 | 2 |';
  const b = paraBlocos(md);
  if (b[0].tipo === 'tabela') ok('tabela é reconhecida'); else bad('tabela', b[0].tipo);
  if (b[0].linhas && b[0].linhas.length === 2) ok('a régua do markdown não vira linha de dado');
  else bad('régua virou linha', JSON.stringify(b[0].linhas));

  const uma = voltaEMeia(md);
  const duas = voltaEMeia(uma);
  if (uma === duas) ok('tabela é estável na ida e volta'); else bad('tabela instável', uma + '\n---\n' + duas);
  if (uma.includes('---')) ok('a régua é recriada ao gravar'); else bad('régua não recriada', uma);
}

/* ----------------------------------------------------- nada se perde */
{
  const md =
    '# Cabeça\n\nParágrafo com **negrito** e `código`.\n\n- item um\n- item dois\n\n' +
    '> citação importante\n\n1. passo\n2. passo\n\n- [ ] pendente\n- [x] pronto\n\n' +
    '```\nlinha de codigo\n```\n\n| c1 | c2 |\n| --- | --- |\n| v1 | v2 |\n\n---\n\nfim';

  const saida = voltaEMeia(md);
  const pedacos = [
    'Cabeça', '**negrito**', '`código`', 'item um', 'item dois',
    'citação importante', 'passo', 'pendente', 'pronto',
    'linha de codigo', 'v1', 'v2', 'fim',
  ];

  const sumiram = pedacos.filter((p) => !saida.includes(p));
  if (sumiram.length === 0) ok('nenhum conteúdo se perde numa nota completa');
  else bad('conteúdo perdido: ' + sumiram.join(', '), saida);

  const uma = saida;
  const duas = voltaEMeia(uma);
  if (uma === duas) ok('nota completa é estável'); else bad('nota completa instável', uma + '\n=====\n' + duas);
}

/* -------------------------------------------------- linhas em branco */
{
  // Linhas em branco somem de propósito (o espaçamento passa a ser do layout).
  // O que não pode acontecer é elas se MULTIPLICAREM a cada abertura.
  const md = 'a\n\n\n\nb';
  const uma = voltaEMeia(md);
  const duas = voltaEMeia(uma);
  const tres = voltaEMeia(duas);
  if (uma === duas && duas === tres) ok('linhas em branco não se multiplicam a cada abertura');
  else bad('linhas em branco instáveis', [uma, duas, tres].map((x) => JSON.stringify(x)).join('\n'));
}

/* --------------------------------------------------------- casos vazios */
{
  const vazios = [['string vazia', ''], ['só espaços', '   '], ['só quebras', '\n\n\n']];
  for (const [rotulo, entrada] of vazios) {
    const b = paraBlocos(entrada);
    if (Array.isArray(b) && b.length >= 1) ok('nota vazia (' + rotulo + ') ainda recebe um bloco para digitar');
    else bad('nota vazia sem bloco: ' + rotulo, JSON.stringify(b));
  }

  for (const entrada of [null, undefined]) {
    try {
      const b = paraBlocos(entrada);
      if (b.length >= 1) ok('paraBlocos tolera ' + String(entrada));
      else bad('paraBlocos ' + String(entrada), JSON.stringify(b));
    } catch (e) {
      bad('paraBlocos lançou com ' + String(entrada), e.message);
    }
  }

  if (paraMarkdown([]) === '') ok('lista de blocos vazia vira texto vazio');
  else bad('lista vazia', JSON.stringify(paraMarkdown([])));
}

/* --------------------------------------------- ids únicos e estáveis */
{
  const b = paraBlocos('# a\n# b\n# c');
  const ids = new Set(b.map((x) => x.id));
  if (ids.size === b.length) ok('cada bloco recebe um id único');
  else bad('ids repetidos', b.map((x) => x.id).join(','));
}

/* --------------------------------------------- bloco novo já nasce válido */
{
  const t = criarBloco('tarefa');
  if (t.marcado === false) ok('tarefa nova nasce desmarcada'); else bad('tarefa nova', JSON.stringify(t));

  const g = criarBloco('grafico');
  if (g.grafico && Array.isArray(g.grafico.dados)) ok('gráfico novo nasce com dados'); else bad('gráfico novo');

  const tb = criarBloco('tabela');
  if (tb.linhas && tb.linhas.length === 2) ok('tabela nova nasce com linhas'); else bad('tabela nova');

  // Um bloco recém-criado tem que sobreviver à ida e volta.
  const md = paraMarkdown([criarBloco('grafico'), criarBloco('tabela'), criarBloco('tarefa', 'x')]);
  const uma = voltaEMeia(md);
  if (uma === voltaEMeia(uma)) ok('blocos recém-criados são estáveis'); else bad('blocos novos instáveis', md);
}

console.log(`\n${pass} passaram, ${fail} falharam\n`);
process.exit(fail > 0 ? 1 : 0);
