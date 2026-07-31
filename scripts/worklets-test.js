#!/usr/bin/env node
/**
 * Caça funções comuns chamadas de dentro da thread de animação.
 *
 * ESTE é o teste que faltava quando o app parou de abrir.
 *
 * O Reanimated roda o corpo de `useAnimatedStyle` e os retornos de gesto na
 * thread de UI, num runtime de JavaScript separado. Uma função declarada fora
 * dali não existe nesse runtime: o plugin do Babel a captura como "remote
 * function", e chamá-la de forma síncrona derruba o processo inteiro com
 *
 *     [Worklets] Tried to synchronously call a Remote Function.
 *
 * O que torna esse defeito perverso é o silêncio de todo o resto: o TypeScript
 * aprova (a função existe e o tipo bate), o ESLint aprova, e o teste em Node
 * aprova — a matemática do carrossel tem 33 testes e todos passam, porque em
 * Node não existe thread de UI. O erro só aparece no aparelho, na hora de
 * desenhar o primeiro quadro. Como o carrossel é a tela inicial, o app morria
 * antes de abrir, e a caixa do Android dizia apenas "Markee parou".
 *
 * Por que é estático e não uma regra de ESLint: a informação necessária está em
 * DOIS arquivos (quem chama e quem é chamado), e regra de lint enxerga um
 * arquivo por vez.
 *
 * Falso positivo aqui custa uma diretiva `'worklet'` a mais, que não quebra
 * nada — a função continua chamável dos dois lados. Falso negativo custa o app
 * inteiro. Por isso, na dúvida, o teste acusa.
 */

const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');

let passaram = 0;
const falhas = [];

function ok(condicao, mensagem) {
  if (condicao) passaram++;
  else falhas.push(mensagem);
}

/* ------------------------------------------------------------------ */
/* varredura de arquivos                                               */
/* ------------------------------------------------------------------ */

function arquivos(dir, achados = []) {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const caminho = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      if (entrada.name === 'node_modules' || entrada.name.startsWith('.')) continue;
      arquivos(caminho, achados);
    } else if (/\.tsx?$/.test(entrada.name)) {
      achados.push(caminho);
    }
  }
  return achados;
}

/* ------------------------------------------------------------------ */
/* onde a thread de UI começa                                          */
/* ------------------------------------------------------------------ */

// Hooks cujo callback roda inteiro na thread de UI.
const HOOKS = [
  'useAnimatedStyle',
  'useDerivedValue',
  'useAnimatedProps',
  'useAnimatedReaction',
  'useAnimatedScrollHandler',
  'useFrameCallback',
  'runOnUI',
];

// Retornos de gesto do gesture-handler. Rodam na thread de UI por padrão —
// só saem dela com `.runOnJS(true)`, que é o caso raro.
const GESTOS = [
  'onBegin',
  'onStart',
  'onUpdate',
  'onChange',
  'onEnd',
  'onFinalize',
  'onTouchesDown',
  'onTouchesMove',
  'onTouchesUp',
];

/** Do `(` de abertura até o `)` que o fecha, respeitando texto e comentário. */
function ateFechar(codigo, inicio) {
  let profundidade = 0;
  let i = inicio;
  let aspas = null;

  while (i < codigo.length) {
    const c = codigo[i];
    const anterior = codigo[i - 1];

    if (aspas) {
      if (c === aspas && anterior !== '\\') aspas = null;
    } else if (c === '"' || c === "'" || c === '`') {
      aspas = c;
    } else if (c === '/' && codigo[i + 1] === '/') {
      i = codigo.indexOf('\n', i);
      if (i < 0) break;
    } else if (c === '/' && codigo[i + 1] === '*') {
      i = codigo.indexOf('*/', i);
      if (i < 0) break;
      i += 1;
    } else if (c === '(') {
      profundidade++;
    } else if (c === ')') {
      profundidade--;
      if (profundidade === 0) return codigo.slice(inicio, i + 1);
    }
    i++;
  }
  return codigo.slice(inicio);
}

function corposDeWorklet(codigo) {
  const corpos = [];
  const alvos = [
    ...HOOKS.map((h) => new RegExp(`\\b${h}\\s*\\(`, 'g')),
    ...GESTOS.map((g) => new RegExp(`\\.${g}\\s*\\(`, 'g')),
  ];

  for (const padrao of alvos) {
    let m;
    while ((m = padrao.exec(codigo))) {
      const abre = codigo.indexOf('(', m.index);
      corpos.push(ateFechar(codigo, abre));
    }
  }
  return corpos;
}

/* ------------------------------------------------------------------ */
/* de onde cada nome veio                                              */
/* ------------------------------------------------------------------ */

function importesLocais(codigo, arquivo) {
  const mapa = new Map();
  const padrao = /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+'([^']+)'/g;
  let m;

  while ((m = padrao.exec(codigo))) {
    const modulo = m[2];
    // Só o que é nosso: pacote de fora não tem como a gente marcar.
    if (!modulo.startsWith('.') && !modulo.startsWith('@/')) continue;
    // `import type { X }` não traz valor nenhum para o runtime.
    if (/import\s+type\s*\{/.test(m[0])) continue;

    const base = modulo.startsWith('@/')
      ? path.join(RAIZ, 'src', modulo.slice(2))
      : path.resolve(path.dirname(arquivo), modulo);

    for (let nome of m[1].split(',')) {
      nome = nome.trim();
      if (!nome || nome.startsWith('type ')) continue;
      // `a as b` — o que importa é o nome usado aqui.
      const usado = nome.includes(' as ') ? nome.split(' as ')[1].trim() : nome;
      const original = nome.includes(' as ') ? nome.split(' as ')[0].trim() : nome;
      mapa.set(usado, { base, original });
    }
  }
  return mapa;
}

function resolver(base) {
  for (const tentativa of [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
    if (fs.existsSync(tentativa)) return tentativa;
  }
  return null;
}

/** A função declarada neste código é um worklet? */
function ehWorklet(codigo, nome) {
  const declaracoes = [
    new RegExp(`function\\s+${nome}\\s*\\(`),
    new RegExp(`(?:const|let)\\s+${nome}\\s*(?::[^=]+)?=\\s*(?:\\([^)]*\\)|[A-Za-z_$][\\w$]*)\\s*=>`),
  ];

  for (const padrao of declaracoes) {
    const m = padrao.exec(codigo);
    if (!m) continue;

    // A diretiva tem de ser a primeira coisa do corpo. Procurar no arquivo
    // inteiro faria um `'worklet'` de outra função valer por esta.
    const abre = codigo.indexOf('{', m.index + m[0].length - 1);
    if (abre < 0) continue;
    const inicio = codigo.slice(abre + 1, abre + 260);
    if (/^\s*(\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*['"]worklet['"]\s*;/.test(inicio)) return true;
  }
  return false;
}

/** Nomes que não são chamada de função nossa. */
const IGNORAR = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'function',
  'Math', 'Number', 'String', 'Boolean', 'Array', 'Object', 'JSON', 'Date',
  'parseInt', 'parseFloat', 'isNaN', 'require',
]);

/* ------------------------------------------------------------------ */
/* o teste                                                             */
/* ------------------------------------------------------------------ */

const suspeitos = [];

for (const arquivo of [...arquivos(path.join(RAIZ, 'src')), ...arquivos(path.join(RAIZ, 'app'))]) {
  const codigo = fs.readFileSync(arquivo, 'utf8');
  const corpos = corposDeWorklet(codigo);
  if (corpos.length === 0) continue;

  const importes = importesLocais(codigo, arquivo);

  for (const corpo of corpos) {
    for (const m of corpo.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) {
      const nome = m[1];
      if (IGNORAR.has(nome)) continue;

      const vindoDeFora = importes.get(nome);
      if (vindoDeFora) {
        const alvo = resolver(vindoDeFora.base);
        if (!alvo) continue;
        if (!ehWorklet(fs.readFileSync(alvo, 'utf8'), vindoDeFora.original)) {
          suspeitos.push(
            `${path.relative(RAIZ, arquivo)} chama ${nome}() na thread de UI, ` +
              `mas ${path.relative(RAIZ, alvo)} não marca ${vindoDeFora.original} com 'worklet'`
          );
        }
        continue;
      }

      // Declarada no próprio arquivo, fora do worklet.
      const daCasa = new RegExp(
        `(?:^|\\n)\\s*(?:export\\s+)?(?:function\\s+${nome}\\s*\\(|(?:const|let)\\s+${nome}\\s*(?::[^=]+)?=\\s*(?:\\([^)]*\\)|[A-Za-z_$][\\w$]*)\\s*=>)`
      );
      if (daCasa.test(codigo) && !ehWorklet(codigo, nome)) {
        suspeitos.push(
          `${path.relative(RAIZ, arquivo)} chama ${nome}() na thread de UI, ` +
            `mas ${nome} não é worklet`
        );
      }
    }
  }
}

const unicos = [...new Set(suspeitos)];
ok(
  unicos.length === 0,
  `função comum chamada da thread de UI:\n    - ${unicos.join('\n    - ')}`
);

/* O teste precisa provar que ENXERGA alguma coisa. Um bug no extrator faria
   ele achar zero worklet e passar para sempre, calado. */
const carrossel = fs.readFileSync(
  path.join(RAIZ, 'src/features/categories/components/CategoryCarousel.tsx'),
  'utf8'
);
ok(corposDeWorklet(carrossel).length >= 2, 'o extrator achou os worklets do carrossel');

const matematica = fs.readFileSync(path.join(RAIZ, 'src/features/categories/carousel-math.ts'), 'utf8');
ok(ehWorklet(matematica, 'posicaoDoCartao'), "posicaoDoCartao está marcada com 'worklet'");
ok(ehWorklet(matematica, 'distanciaNoAnel'), "distanciaNoAnel está marcada com 'worklet'");
ok(ehWorklet(matematica, 'destinoAoSoltar'), "destinoAoSoltar está marcada com 'worklet'");
ok(!ehWorklet(matematica, 'visiveis'), 'visiveis segue comum (só é chamada no render)');

/* ------------------------------------------------------------------ */

if (falhas.length) {
  console.error(`\n${falhas.length} falha(s):`);
  for (const f of falhas) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`${passaram} passaram — nenhuma função comum chamada da thread de UI.`);
