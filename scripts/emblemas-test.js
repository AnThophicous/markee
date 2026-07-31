/**
 * Testes dos emblemas e dos efeitos de decoração.
 *
 * Dois assuntos no mesmo arquivo porque os dois testam a MESMA classe de
 * defeito: uma lista escrita em dois lugares que se separam sem ninguém notar.
 *
 *   EMBLEMAS  o servidor manda códigos ('pro', 'fundador'); o catálogo do
 *             aplicativo traduz. Código no servidor que falta no catálogo some
 *             da tela em silêncio.
 *
 *   EFEITOS   a lista em visual.ts precisa bater com a whitelist do banco E com
 *             o que o ThemeEffect sabe desenhar. Efeito que existe no TypeScript
 *             e não no SQL faz o salvamento falhar; efeito que existe nos dois
 *             mas não é desenhado salva certo e não aparece — o pior dos três,
 *             porque não há erro nenhum para investigar.
 */
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

function carregar(arquivo) {
  const src = fs.readFileSync(path.join(__dirname, '..', arquivo), 'utf8');
  const { outputText } = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const mod = { exports: {} };
  new Function('module', 'exports', outputText)(mod, mod.exports);
  return mod.exports;
}

const { EMBLEMAS, acharEmblema, emblemasDe, emblemasNaLinha } = carregar(
  'src/features/medals/emblemas.ts'
);
const { EFFECTS, EFFECT_ORDER, parseTheme, isPremiumTheme } = carregar('src/theme/visual.ts');

let pass = 0;
let fail = 0;
const ok = (n) => { pass++; console.log('  OK   ' + n); };
const bad = (n, d) => { fail++; console.log('  FAIL ' + n + (d !== undefined ? ' -> ' + d : '')); };
const eq = (n, a, b) => (a === b ? ok(n) : bad(n, `esperava ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`));

console.log('\nEmblemas e efeitos\n');

/* ====================================================== EMBLEMAS */

// Os códigos que as funções emblemas_do_grupo e emblemas_do_perfil devolvem.
// Lidos do SQL, e não escritos à mão aqui: à mão, este teste passaria a
// concordar com ele mesmo em vez de com o servidor.
const sqlEmblemas = fs.readFileSync(
  path.join(__dirname, '../supabase/migrations/0029_emblemas_de_grupo.sql'),
  'utf8'
);
const doServidor = new Set(
  [...sqlEmblemas.matchAll(/select '(\w+)'(?:::text)? as emblema|union all\s+select '(\w+)'/g)]
    .map((m) => m[1] || m[2])
    .filter(Boolean)
);

{
  const noCatalogo = new Set(EMBLEMAS.map((e) => e.codigo));
  const faltando = [...doServidor].filter((c) => !noCatalogo.has(c));
  if (faltando.length === 0) ok('todo emblema do servidor está no catálogo');
  else bad('emblema do servidor sem tradução no app', faltando.join(', '));

  // O contrário é só desperdício, não defeito — mas denuncia catálogo velho.
  const sobrando = [...noCatalogo].filter((c) => !doServidor.has(c));
  if (sobrando.length === 0) ok('e nenhum emblema do catálogo é inventado');
  else bad('emblema no app que o servidor nunca manda', sobrando.join(', '));
}

{
  const ids = new Set(EMBLEMAS.map((e) => e.codigo));
  eq('nenhum código repetido', ids.size, EMBLEMAS.length);
  if (EMBLEMAS.every((e) => e.nome && e.como && e.icone && e.cor.startsWith('#')))
    ok('todo emblema tem nome, explicação, ícone e cor');
  else bad('emblema incompleto');
}

// A regra que segura tudo: versão nova do servidor não pode derrubar app velho.
eq('código desconhecido não vira emblema', acharEmblema('emblema-do-futuro'), null);
eq('e some da lista em vez de quebrar', emblemasDe(['pro', 'coisa-nova']).length, 1);
eq('lista vazia continua vazia', emblemasDe([]).length, 0);

{
  // A ordem é a do catálogo, não a que o servidor mandou — o banco devolve na
  // ordem das cláusulas, que não tem nada a ver com o que é mais importante.
  const fora = emblemasDe(['conversador', 'dono', 'pro']);
  eq('a ordem é a do catálogo', fora[0].codigo, 'dono');
  eq('e o segundo também', fora[1].codigo, 'pro');
}

{
  const muitos = ['dono', 'pro', 'padrinho', 'fundador', 'veterano'];
  const { mostrar, resto } = emblemasNaLinha(muitos);
  eq('a linha do nome mostra três', mostrar.length, 3);
  eq('e conta o resto', resto, 2);
  eq('os três são os mais importantes', mostrar[0].codigo, 'dono');
}
{
  const { mostrar, resto } = emblemasNaLinha(['pro']);
  eq('com um só, nenhum resto', resto, 0);
  eq('e ele aparece', mostrar.length, 1);
}

/* ======================================================= EFEITOS */

const sqlEfeitos = fs.readFileSync(
  path.join(__dirname, '../supabase/migrations/0030_mais_efeitos.sql'),
  'utf8'
);
// Só a lista de dentro do is_valid_effect, e não qualquer texto entre aspas do
// arquivo — o comentário lá em cima cita nomes de efeito.
const corpo = sqlEfeitos.slice(
  sqlEfeitos.indexOf('is_valid_effect'),
  sqlEfeitos.indexOf('$$;', sqlEfeitos.indexOf('is_valid_effect'))
);
const noBanco = new Set([...corpo.matchAll(/'(\w+)'/g)].map((m) => m[1]));

{
  const noApp = new Set(EFFECT_ORDER);
  const soNoApp = [...noApp].filter((e) => !noBanco.has(e));
  const soNoBanco = [...noBanco].filter((e) => !noApp.has(e));

  // Este é o que dói: o efeito aparece no seletor, a pessoa escolhe, e o banco
  // recusa com "Efeito desconhecido" na cara dela.
  if (soNoApp.length === 0) ok('todo efeito do seletor é aceito pelo banco');
  else bad('efeito que o banco recusaria', soNoApp.join(', '));

  if (soNoBanco.length === 0) ok('e o banco não aceita nada que o app não ofereça');
  else bad('efeito órfão na whitelist', soNoBanco.join(', '));
}

{
  // Efeito na lista sem desenho: salva certo e não acontece nada na tela.
  const componente = fs.readFileSync(
    path.join(__dirname, '../src/components/ThemeEffect.tsx'),
    'utf8'
  );
  const semDesenho = EFFECT_ORDER.filter(
    (e) => e !== 'none' && !componente.includes(`effect === '${e}'`)
  );
  if (semDesenho.length === 0) ok('todo efeito tem um desenho no ThemeEffect');
  else bad('efeito que não desenha nada', semDesenho.join(', '));

  // E duração declarada: sem entrada no mapa, a animação roda com duração
  // `undefined`, que no Reanimated vira o padrão de 300ms — rápido demais.
  const semDuracao = EFFECT_ORDER.filter(
    (e) => !new RegExp(`^\\s+${e}:\\s*\\d+`, 'm').test(componente)
  );
  if (semDuracao.length === 0) ok('e uma duração declarada');
  else bad('efeito sem duração', semDuracao.join(', '));
}

{
  if (EFFECT_ORDER.every((e) => EFFECTS[e] && EFFECTS[e].label && EFFECTS[e].hint))
    ok('todo efeito tem nome e explicação no seletor');
  else bad('efeito sem rótulo');

  eq('"nenhum" é o único gratuito', EFFECT_ORDER.filter((e) => !EFFECTS[e].pro).length, 1);
  eq('e é o primeiro da lista', EFFECT_ORDER[0], 'none');
}

{
  // Tema gravado antes de um efeito existir, ou por um app modificado.
  eq('efeito inventado cai em nenhum', parseTheme({ kind: 'solid', colors: ['#000'], effect: 'lava' }).effect, 'none');
  eq('e um efeito novo de verdade passa', parseTheme({ kind: 'solid', colors: ['#000'], effect: 'aurora' }).effect, 'aurora');
  eq('efeito novo conta como Pro', isPremiumTheme({ kind: 'solid', colors: ['#000'], effect: 'neon', card: 'plain' }), true);
}

console.log(`\n${pass} passaram, ${fail} falharam\n`);
process.exit(fail === 0 ? 0 : 1);
