/**
 * Testes das medalhas.
 *
 * Elas são calculadas do banco LOCAL e vistas só por quem conquistou — nada vai
 * para o servidor, nada aparece no perfil que os outros veem. Um APK modificado
 * consegue se dar todas, e o estrago é zero.
 *
 * O que se protege aqui, então, não é contra trapaça: é contra a medalha que
 * SOME. Perder a ofensiva já dói; ver a medalha de "30 dias seguidos" desaparecer
 * junto é o tipo de coisa que faz desinstalar o app. Por isso a família da
 * ofensiva olha o RECORDE, e há um teste só para isso.
 */
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../src/features/medals/medalhas.ts'), 'utf8');
const { outputText } = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const mod = { exports: {} };
new Function('module', 'exports', outputText)(mod, mod.exports);
const {
  MEDALHAS,
  NUMEROS_ZERADOS,
  estadoDas,
  conquistadas,
  proximaMedalha,
  molduraDe,
  placar,
  COR_DO_NIVEL,
} = mod.exports;

let pass = 0;
let fail = 0;
const ok = (n) => { pass++; console.log('  OK   ' + n); };
const bad = (n, d) => { fail++; console.log('  FAIL ' + n + (d !== undefined ? ' -> ' + d : '')); };
const eq = (n, a, b) => (a === b ? ok(n) : bad(n, `esperava ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`));

const num = (extra = {}) => ({ ...NUMEROS_ZERADOS, ...extra });

console.log('\nMedalhas\n');

/* ----------------------------------------------------------- o catálogo */
eq('quatro famílias de quatro degraus', MEDALHAS.length, 16);
{
  const ids = new Set(MEDALHAS.map((m) => m.id));
  eq('nenhum id repetido', ids.size, MEDALHAS.length);
  const familias = new Set(MEDALHAS.map((m) => m.familia));
  eq('quatro famílias distintas', familias.size, 4);
  if (MEDALHAS.every((m) => COR_DO_NIVEL[m.nivel])) ok('todo nível tem cor');
  else bad('nível sem cor');
  if (MEDALHAS.every((m) => m.comoGanhar && m.nome && m.icone)) ok('toda medalha diz como se ganha');
  else bad('medalha sem instrução');
}
{
  // O primeiro degrau tem de ser fácil de verdade: medalha que só cai no
  // segundo mês não motiva ninguém no primeiro dia, que é quando a pessoa
  // decide se continua usando o app.
  const familias = ['ofensiva', 'cartas', 'notas', 'aulas'];
  const primeiras = familias.map((f) =>
    MEDALHAS.filter((m) => m.familia === f).reduce((a, b) => (a.meta < b.meta ? a : b))
  );
  if (primeiras.every((m) => m.nivel === 'bronze')) ok('o degrau mais baixo de cada família é bronze');
  else bad('degrau mais baixo não é bronze');

  // E o último tem de ser longo: um conjunto que se completa em duas semanas
  // vira tela morta pelo resto do uso.
  const ultimas = familias.map((f) =>
    MEDALHAS.filter((m) => m.familia === f).reduce((a, b) => (a.meta > b.meta ? a : b))
  );
  if (ultimas.every((m) => m.nivel === 'diamante')) ok('o mais alto de cada família é diamante');
  else bad('o mais alto não é diamante');
  if (ultimas.every((m) => m.meta >= 100)) ok('e todo diamante exige muito');
  else bad('diamante fácil demais', JSON.stringify(ultimas.map((m) => m.meta)));
}
{
  // Metas em ordem crescente dentro da família: bronze não pode pedir mais que
  // prata, ou a barra de progresso andaria para trás ao subir de nível.
  const porFamilia = {};
  for (const m of MEDALHAS) (porFamilia[m.familia] ??= []).push(m);
  const ordem = ['bronze', 'prata', 'ouro', 'diamante'];
  let certo = true;
  for (const lista of Object.values(porFamilia)) {
    const ordenada = [...lista].sort((a, b) => ordem.indexOf(a.nivel) - ordem.indexOf(b.nivel));
    for (let i = 1; i < ordenada.length; i += 1) {
      if (ordenada[i].meta <= ordenada[i - 1].meta) certo = false;
    }
  }
  if (certo) ok('as metas crescem junto com o nível');
  else bad('meta fora de ordem dentro da família');
}

/* --------------------------------------------------- conquista e progresso */
eq('conta zerada não ganha nada', conquistadas(num()).length, 0);
{
  const e = estadoDas(num({ cartasRevisadas: 10 }));
  const bronze = e.find((m) => m.id === 'cartas-bronze');
  eq('bater a meta exata conquista', bronze.conquistada, true);
  const prata = e.find((m) => m.id === 'cartas-prata');
  eq('e o degrau seguinte continua bloqueado', prata.conquistada, false);
  eq('com progresso proporcional', Math.round(prata.fracao * 100), 10);
}
{
  const e = estadoDas(num({ cartasRevisadas: 99999 }));
  const prata = e.find((m) => m.id === 'cartas-prata');
  eq('passar muito da meta não estoura a fração', prata.fracao, 1);
}
{
  const e = estadoDas(num({ notasEscritas: -5 }));
  const bronze = e.find((m) => m.id === 'notas-bronze');
  eq('número negativo (banco corrompido) vira zero', bronze.atual, 0);
  eq('e não conquista nada', bronze.conquistada, false);
}

/* -------------- A REGRA QUE MAIS IMPORTA: medalha não pode sumir */
{
  // Estudou 40 dias seguidos e esqueceu um. A ofensiva atual zera; a medalha de
  // 30 dias NÃO pode zerar junto — punir duas vezes o mesmo dia esquecido é o
  // que faz a pessoa largar o app justo quando ela mais precisa de motivo.
  const perdeu = num({ ofensiva: 0, recordeDeOfensiva: 40 });
  const e = estadoDas(perdeu);
  eq('perder a ofensiva não tira a medalha já ganha', e.find((m) => m.id === 'ofensiva-ouro').conquistada, true);
  eq('nem a de bronze', e.find((m) => m.id === 'ofensiva-bronze').conquistada, true);
  eq('e a de diamante continua faltando', e.find((m) => m.id === 'ofensiva-diamante').conquistada, false);
}
{
  // O contrário também: se a ofensiva atual for maior que o recorde gravado
  // (banco antigo, migração), vale a maior das duas.
  const e = estadoDas(num({ ofensiva: 50, recordeDeOfensiva: 3 }));
  eq('vale sempre o maior entre atual e recorde', e.find((m) => m.id === 'ofensiva-ouro').conquistada, true);
}

/* ------------------------------------------------------- a próxima meta */
{
  // A MAIS PERTO, não a mais fácil em números absolutos: "faltam 2 dias"
  // motiva, "faltam 1900 cartas" faz fechar a tela.
  const p = proximaMedalha(num({ ofensiva: 6, recordeDeOfensiva: 6, cartasRevisadas: 1 }));
  eq('a próxima é a de maior fração', p.id, 'ofensiva-prata');
}
eq('com nada feito, ainda há uma próxima', proximaMedalha(num()) !== null, true);
{
  const tudo = num({
    recordeDeOfensiva: 100,
    cartasRevisadas: 2000,
    notasEscritas: 400,
    minutosGravados: 5000,
  });
  eq('com tudo conquistado, não há próxima', proximaMedalha(tudo), null);
  eq('e o placar bate', placar(tudo).ganhas, MEDALHAS.length);
}

/* ----------------------------------------------------------- a moldura */
// Anel cinza em volta de quem ainda não conquistou nada transforma "não
// comecei" em "sou o mais fraco". Por isso é nulo, não bronze.
eq('sem medalha, nenhuma moldura', molduraDe(num()), null);
eq('a moldura é o melhor nível ganho', molduraDe(num({ cartasRevisadas: 10 })), 'bronze');
eq('e sobe com o melhor', molduraDe(num({ cartasRevisadas: 500 })), 'ouro');
{
  // Uma de ouro numa família e uma de bronze em outra: a moldura é a MELHOR,
  // não a última nem a média.
  const m = molduraDe(num({ cartasRevisadas: 500, notasEscritas: 5 }));
  eq('mistura de níveis fica com o mais alto', m, 'ouro');
}
eq('diamante manda em tudo', molduraDe(num({ minutosGravados: 5000 })), 'diamante');

/* -------------------------------------------------------------- placar */
{
  const p = placar(num({ cartasRevisadas: 10, notasEscritas: 5 }));
  eq('duas conquistadas', p.ganhas, 2);
  eq('de dezesseis', p.total, 16);
}

console.log(`\n${pass} passaram, ${fail} falharam\n`);
process.exit(fail === 0 ? 0 : 1);
