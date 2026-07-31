/**
 * Testes das conquistas de ofensiva e do protetor.
 *
 * O protetor é a parte perigosa: ele gasta um recurso guardado, sozinho, sem
 * ninguém apertar botão. Errar para um lado torra os protetores de quem nem
 * precisava; errar para o outro deixa a ofensiva cair com dois protetores
 * parados na conta — e essa é a que faz desinstalar o app.
 *
 * Por isso quase todo teste aqui é do `protecaoNecessaria`, e cada um nomeia o
 * caso concreto que ele impede.
 */
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

function carregar(arquivo, extras = {}) {
  const src = fs.readFileSync(path.join(__dirname, '..', arquivo), 'utf8');
  const { outputText } = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const mod = { exports: {} };
  const req = (nome) => {
    for (const [chave, valor] of Object.entries(extras)) if (nome.endsWith(chave)) return valor;
    throw new Error('import não previsto: ' + nome);
  };
  new Function('module', 'exports', 'require', outputText)(mod, mod.exports, req);
  return mod.exports;
}

const streak = carregar('src/features/stats/streak.ts');
const {
  MARCOS,
  marcosDa,
  proximoMarco,
  marcoAlcancado,
  protetoresDisponiveis,
  protecaoNecessaria,
  DIAS_POR_PROTETOR,
  TETO_DE_PROTETORES,
  TETO_PRO,
} = carregar('src/features/stats/conquistas.ts', { streak });

let pass = 0;
let fail = 0;
const ok = (n) => { pass++; console.log('  OK   ' + n); };
const bad = (n, d) => { fail++; console.log('  FAIL ' + n + (d !== undefined ? ' -> ' + d : '')); };
const eq = (n, a, b) => (a === b ? ok(n) : bad(n, `esperava ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`));
const eqL = (n, a, b) =>
  JSON.stringify(a) === JSON.stringify(b) ? ok(n) : bad(n, `esperava ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`);

console.log('\nOfensiva\n');

/* ------------------------------------------------------------ os marcos */
{
  const dias = MARCOS.map((m) => m.dias);
  eqL('os marcos estão em ordem crescente', dias, [...dias].sort((a, b) => a - b));
  eq('o primeiro é fácil de alcançar', dias[0] <= 3, true);
  eq('o último é um ano', dias[dias.length - 1], 365);
  if (MARCOS.every((m) => m.nome && m.festa && m.icone && m.cor.startsWith('#')))
    ok('todo marco tem nome, festa, ícone e cor');
  else bad('marco incompleto');
}

eq('conta zerada não conquistou nada', marcosDa(0).filter((m) => m.conquistado).length, 0);
eq('três dias conquistam o primeiro', marcosDa(3).filter((m) => m.conquistado).length, 1);
eq('bater a meta exata conquista', marcosDa(7).find((m) => m.dias === 7).conquistado, true);
eq('passar não estoura a fração', marcosDa(99999).find((m) => m.dias === 365).fracao, 1);
eq('número negativo vira zero', marcosDa(-10).filter((m) => m.conquistado).length, 0);

{
  // A MESMA regra das medalhas: o recorde manda, não a ofensiva de agora.
  // Perder a sequência já dói; ver "Um mês" apagar junto é o que faz largar.
  const perdeu = marcosDa(40);
  eq('quem já fez 40 dias mantém o marco de 30', perdeu.find((m) => m.dias === 30).conquistado, true);
  eq('e ainda não tem o de 50', perdeu.find((m) => m.dias === 50).conquistado, false);
}

eq('a próxima meta olha o presente', proximoMarco(5).marco.dias, 7);
eq('e diz quanto falta', proximoMarco(5).faltam, 2);
eq('com tudo feito, não há próxima', proximoMarco(365), null);
eq('em cima do marco, a próxima é a seguinte', proximoMarco(7).marco.dias, 14);
eq('cruzar um marco é reconhecido', marcoAlcancado(30).dias, 30);
eq('e um dia qualquer não é', marcoAlcancado(31), null);

/* --------------------------------------------------------- os protetores */
eq('sem dias estudados, nenhum protetor', protetoresDisponiveis(0, 0), 0);
eq('seis dias ainda não dão um', protetoresDisponiveis(6, 0), 0);
eq('sete dias dão um', protetoresDisponiveis(DIAS_POR_PROTETOR, 0), 1);
eq('quinze dias dão dois', protetoresDisponiveis(15, 0), 2);
eq('o teto segura em dois', protetoresDisponiveis(300, 0), TETO_DE_PROTETORES);
eq('e o Pro guarda três', protetoresDisponiveis(300, 0, true), TETO_PRO);
eq('gastar desconta', protetoresDisponiveis(15, 1), 1);
eq('gastar tudo zera', protetoresDisponiveis(15, 2), 0);
eq('banco corrompido não devolve negativo', protetoresDisponiveis(7, 99), 0);

/* ------------------------------------------- quando o protetor deve agir */
const HOJE = '2026-07-31';
const dia = (n) => {
  const d = new Date('2026-07-31T12:00:00');
  d.setDate(d.getDate() - n);
  return streak.diaDe(d);
};

eqL('estudou hoje: nada a proteger', protecaoNecessaria([HOJE], 2, HOJE), []);
eqL('estudou ontem e hoje ainda não: a ofensiva está viva', protecaoNecessaria([dia(1)], 2, HOJE), []);

{
  // O caso de existir: esqueceu ontem, estudou anteontem, tem protetor.
  const r = protecaoNecessaria([dia(2), dia(3), dia(4)], 1, HOJE);
  eqL('esqueceu um dia: o protetor cobre ontem', r, [dia(1)]);
}
{
  const r = protecaoNecessaria([dia(3), dia(4)], 2, HOJE);
  eqL('esqueceu dois e tem dois: cobre os dois, do mais velho ao mais novo', r, [dia(2), dia(1)]);
}
{
  // Não gasta o que não cobre o buraco inteiro. Queimar um protetor num buraco
  // de dois dias não salvaria a ofensiva — só perderia o protetor.
  eqL('esqueceu dois e tem um: não gasta à toa', protecaoNecessaria([dia(3)], 1, HOJE), []);
}
{
  // Instalou, usou um dia, sumiu um mês. Aqui não há ofensiva a salvar, e
  // torrar os dois protetores na volta seria o pior recebimento possível.
  eqL('sumiu por um mês: não gasta nada', protecaoNecessaria([dia(30)], 2, HOJE), []);
}
eqL('sem protetor, não faz nada', protecaoNecessaria([dia(2)], 0, HOJE), []);
eqL('conta nova sem nenhum dia', protecaoNecessaria([], 2, HOJE), []);
{
  // Já protegido ontem, hoje ainda não estudou: não protege de novo.
  eqL('dia já coberto não é coberto duas vezes', protecaoNecessaria([dia(2), dia(1)], 2, HOJE), []);
}

/* ------------------------------------ o protetor conta para a ofensiva */
{
  // É o ponto do recurso inteiro: com o dia coberto, a contagem atravessa.
  const comProtetor = streak.calcularOfensiva([dia(4), dia(3), dia(2), dia(1)], HOJE);
  eq('com o buraco coberto, a ofensiva continua', comProtetor.atual, 4);

  const semProtetor = streak.calcularOfensiva([dia(4), dia(3), dia(2)], HOJE);
  eq('e sem cobrir, ela para', semProtetor.atual, 0);
}

console.log(`\n${pass} passaram, ${fail} falharam\n`);
process.exit(fail === 0 ? 0 : 1);
