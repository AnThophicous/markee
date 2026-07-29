/**
 * Testes do extrato de crédito.
 *
 * Isto é dinheiro de quem paga, e o defeito perigoso aqui não derruba nada:
 * mostra o número errado. Extrato somado errado, ou fora de ordem, faz a pessoa
 * achar que foi cobrada duas vezes — e nesse ponto não adianta o servidor estar
 * certo, porque a confiança já foi.
 *
 * O outro alvo é a PROJEÇÃO. É a única coisa aqui que inventa um número, e a
 * regra dela é saber quando calar a boca: com dados de menos, devolve nulo e a
 * tela não mostra nada. Um "dura 3 dias" errado é pior que espaço em branco.
 */
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../src/features/billing/creditos.ts'), 'utf8');
const { outputText } = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const mod = { exports: {} };
new Function('module', 'exports', outputText)(mod, mod.exports);
const {
  gastoPorMotivo,
  agruparPorDia,
  duracaoDoSaldo,
  nomeDoMotivo,
  iconeDoMotivo,
  emReais,
  precoPorCredito,
  desconto,
} = mod.exports;

let pass = 0;
let fail = 0;
const ok = (n) => { pass++; console.log('  OK   ' + n); };
const bad = (n, d) => { fail++; console.log('  FAIL ' + n + (d !== undefined ? ' -> ' + d : '')); };
const eq = (n, a, b) => (a === b ? ok(n) : bad(n, `esperava ${b}, veio ${a}`));

console.log('\nExtrato de crédito\n');

const DIA = 24 * 60 * 60 * 1000;
const AGORA = new Date('2026-07-29T15:00:00').getTime();
const linha = (id, delta, motivo, diasAtras) => ({
  id,
  delta,
  motivo,
  quando: AGORA - diasAtras * DIA,
});

/* ------------------------------------------------- para onde o crédito foi */
{
  const linhas = [
    linha(1, -5, 'ia', 0),
    linha(2, -3, 'ia', 1),
    linha(3, -12, 'transcricao', 1),
    linha(4, 300, 'compra', 2),
  ];
  const g = gastoPorMotivo(linhas);
  eq('só dois motivos gastaram', g.length, 2);
  eq('o maior gasto vem primeiro', g[0].motivo, 'transcricao');
  eq('e soma certo', g[0].creditos, 12);
  eq('o segundo soma as duas linhas de IA', g[1].creditos, 8);
  eq('a fração do maior', Math.round(g[0].fracao * 100), 60);
  eq('a fração do segundo', Math.round(g[1].fracao * 100), 40);

  // A COMPRA NÃO PODE ENTRAR. Se entrasse, uma barra gigante de "compra"
  // ficaria ao lado das de consumo e a pergunta "o que está gastando" ficaria
  // sem resposta.
  if (!g.some((x) => x.motivo === 'compra')) ok('entrada de crédito não vira "gasto"');
  else bad('a compra entrou no gráfico de gastos');
}

eq('sem linha nenhuma, nenhum gasto', gastoPorMotivo([]).length, 0);
eq('só com entradas, nenhum gasto', gastoPorMotivo([linha(1, 100, 'compra', 0)]).length, 0);
{
  // Divisão por zero: total zero não pode virar NaN na largura da barra.
  const g = gastoPorMotivo([linha(1, -1, 'ia', 0)]);
  eq('um gasto só ocupa a barra inteira', g[0].fracao, 1);
  if (Number.isFinite(g[0].fracao)) ok('a fração nunca é NaN');
  else bad('a fração virou NaN');
}

/* ------------------------------------------------------ agrupado por dia */
{
  const linhas = [
    linha(1, -5, 'ia', 0),
    linha(2, -3, 'ia', 0),
    linha(3, -12, 'transcricao', 1),
    linha(4, 300, 'compra', 5),
  ];
  const g = agruparPorDia(linhas, AGORA);
  eq('três dias distintos', g.length, 3);
  eq('o de hoje se chama Hoje', g[0].titulo, 'Hoje');
  eq('e junta as duas linhas de hoje', g[0].linhas.length, 2);
  eq('o de ontem se chama Ontem', g[1].titulo, 'Ontem');
  if (/\d+ de \w+/.test(g[2].titulo)) ok('mais antigo vira data por extenso');
  else bad('data por extenso', g[2].titulo);
}
{
  // A ORDEM: as linhas já vêm ordenadas do servidor, e o agrupamento não pode
  // reordenar. Reordenar aqui esconderia um erro de ordenação lá.
  const linhas = [linha(1, -5, 'ia', 0), linha(2, -3, 'ia', 2), linha(3, -1, 'ia', 1)];
  const g = agruparPorDia(linhas, AGORA);
  eq('a ordem recebida é preservada', g.map((x) => x.linhas[0].id).join(','), '1,2,3');
}
eq('extrato vazio não gera grupo', agruparPorDia([], AGORA).length, 0);

/* ---------------------------------------------- A PROJEÇÃO: quando calar */
{
  eq('sem consumo nenhum, não projeta', duracaoDoSaldo(100, [], AGORA), null);
  eq('com um consumo só, não projeta', duracaoDoSaldo(100, [linha(1, -5, 'ia', 1)], AGORA), null);
  eq(
    'com dois consumos, ainda não projeta',
    duracaoDoSaldo(100, [linha(1, -5, 'ia', 1), linha(2, -5, 'ia', 2)], AGORA),
    null
  );

  // Três consumos em três dias, 10 por dia -> 100 de saldo dura 10 dias.
  const tres = [linha(1, -10, 'ia', 1), linha(2, -10, 'ia', 2), linha(3, -10, 'ia', 3)];
  eq('com três, projeta', duracaoDoSaldo(100, tres, AGORA), 10);

  eq('saldo zero dura zero dias', duracaoDoSaldo(0, tres, AGORA), 0);
  eq('saldo negativo também', duracaoDoSaldo(-5, tres, AGORA), 0);

  // Consumo velho não conta: quem gastou muito há seis meses e parou não deve
  // ver "dura 2 dias" com o saldo intacto.
  const velhos = [linha(1, -50, 'ia', 200), linha(2, -50, 'ia', 201), linha(3, -50, 'ia', 202)];
  eq('consumo de meses atrás é ignorado', duracaoDoSaldo(100, velhos, AGORA), null);

  // Só entradas nos últimos 30 dias: não há ritmo de gasto para projetar.
  const soEntrada = [linha(1, 100, 'compra', 1), linha(2, 100, 'compra', 2), linha(3, 100, 'compra', 3)];
  eq('só compras não viram projeção', duracaoDoSaldo(100, soEntrada, AGORA), null);
}
{
  // Tudo no mesmo instante: a divisão por (agora - maisAntiga) seria zero.
  const mesmoInstante = [linha(1, -5, 'ia', 0), linha(2, -5, 'ia', 0), linha(3, -5, 'ia', 0)];
  const d = duracaoDoSaldo(100, mesmoInstante, AGORA);
  if (d !== null && Number.isFinite(d)) ok('consumo todo no mesmo instante não divide por zero');
  else bad('projeção virou infinito ou nulo', d);
}

/* ----------------------------------------------------- nomes e ícones */
eq('ia vira Assistente', nomeDoMotivo('ia'), 'Assistente');
eq('transcricao vira Transcrição', nomeDoMotivo('transcricao'), 'Transcrição');
// Motivo novo vai aparecer no servidor antes de o app ser atualizado. Precisa
// mostrar algo legível em vez de uma linha em branco.
eq('motivo desconhecido vira ele mesmo, capitalizado', nomeDoMotivo('resgate'), 'Resgate');
eq('motivo desconhecido ganha um ícone genérico', iconeDoMotivo('resgate'), 'circle');
if (nomeDoMotivo('')) bad('motivo vazio devolveu texto'); else ok('motivo vazio não inventa nome');

/* -------------------------------------------------------------- preços */
eq('339 centavos em reais', emReais(339), 'R$ 3,39');
eq('2690 centavos em reais', emReais(2690), 'R$ 26,90');
eq('centavo redondo mantém as duas casas', emReais(300), 'R$ 3,00');
eq('preço por crédito do pacote de 100', precoPorCredito(339, 100), 'R$ 0,0339 cada');
eq('pacote sem crédito não divide por zero', precoPorCredito(339, 0), '');

/* ---------------------- o desconto por volume, que é o que vende o pacote */
{
  // Os preços de verdade da migração 0023: 339/100, 949/300, 3190/1000.
  eq('o menor pacote não tem desconto sobre si mesmo', desconto(339, 100, 339, 100), 0);
  eq('o de 300 é 7% mais barato por crédito', desconto(949, 300, 339, 100), 7);
  eq('o de 1000 é 6% mais barato', desconto(3190, 1000, 339, 100), 6);
  eq('referência zerada não divide por zero', desconto(949, 300, 0, 100), 0);
  eq('pacote sem crédito não divide por zero', desconto(949, 0, 339, 100), 0);
}

console.log(`\n${pass} passaram, ${fail} falharam\n`);
process.exit(fail === 0 ? 0 : 1);
