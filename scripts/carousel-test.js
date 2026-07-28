/**
 * Testes do carrossel de categorias.
 *
 * Aritmética de anel erra calado. O resto de negativo em JavaScript é negativo
 * (`-1 % 5` dá -1, não 4), e esquecer disso faz o cartão da esquerda aparecer
 * na direita — mas só quando a pessoa arrasta para trás a partir do primeiro
 * item, ou só quando a lista tem número par. Não dá erro, não aparece em
 * revisão, e quem usa só acha o app estranho.
 */
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../src/features/categories/carousel-math.ts'), 'utf8');
const { outputText } = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const mod = { exports: {} };
new Function('module', 'exports', outputText)(mod, mod.exports);
const { distanciaNoAnel, posicaoDoCartao, visiveis, destinoAoSoltar } = mod.exports;

let pass = 0;
let fail = 0;
const ok = (n) => { pass++; console.log('  OK   ' + n); };
const bad = (n, d) => { fail++; console.log('  FAIL ' + n + (d !== undefined ? ' -> ' + d : '')); };

console.log('\nCarrossel de categorias\n');

/* ---------------------------------------------------- distância no anel */
{
  // Cinco categorias, a do meio é a de índice 2.
  const d = (i, a = 2, n = 5) => distanciaNoAnel(i, a, n);
  if (d(2) === 0) ok('o item ativo está no meio');
  else bad('ativo fora do meio', d(2));

  if (d(1) === -1 && d(3) === 1) ok('os vizinhos ficam um de cada lado');
  else bad('vizinhos', `${d(1)}, ${d(3)}`);

  if (d(0) === -2 && d(4) === 2) ok('os de dois passos ficam nas pontas');
  else bad('dois passos', `${d(0)}, ${d(4)}`);
}

{
  // O CASO QUE QUEBRA: primeiro item no meio. O último tem de vir pela
  // ESQUERDA (-1), e não estar a quatro passos à direita.
  const d = distanciaNoAnel(4, 0, 5);
  if (d === -1) ok('com o primeiro no meio, o último aparece pela esquerda');
  else bad('o anel não fecha para trás', `esperava -1, veio ${d}`);

  const d2 = distanciaNoAnel(0, 4, 5);
  if (d2 === 1) ok('com o último no meio, o primeiro aparece pela direita');
  else bad('o anel não fecha para a frente', d2);
}

{
  // Índice fora da faixa não pode explodir: durante o arrasto o ativo passa
  // por valores que ainda não foram normalizados.
  if (distanciaNoAnel(0, 7, 5) === -2) ok('ativo acima do total ainda dá volta certa');
  else bad('ativo fora da faixa', distanciaNoAnel(0, 7, 5));

  if (distanciaNoAnel(0, -1, 5) === 1) ok('ativo negativo ainda dá volta certa');
  else bad('ativo negativo', distanciaNoAnel(0, -1, 5));
}

{
  if (distanciaNoAnel(0, 0, 0) === 0) ok('lista vazia não divide por zero');
  else bad('lista vazia', distanciaNoAnel(0, 0, 0));

  if (distanciaNoAnel(0, 0, 1) === 0) ok('lista de um item fica sempre no meio');
  else bad('lista de um', distanciaNoAnel(0, 0, 1));

  // Com total PAR o oposto empata; precisa de um critério fixo, senão pisca.
  const a = distanciaNoAnel(2, 0, 4);
  const b = distanciaNoAnel(2, 0, 4);
  if (a === b) ok('o item oposto numa lista par escolhe sempre o mesmo lado');
  else bad('o oposto oscila', `${a} vs ${b}`);
}

/* ------------------------------------------------------ aparência do cartão */
{
  const meio = posicaoDoCartao(2, 2, 5);
  const lado = posicaoDoCartao(3, 2, 5);
  const atras = posicaoDoCartao(0, 2, 5);

  if (meio.escala > lado.escala) ok('o cartão do meio é maior que os dos lados');
  else bad('escalas', `${meio.escala} vs ${lado.escala}`);

  if (meio.opacidade > lado.opacidade) ok('o cartão do meio é mais opaco');
  else bad('opacidades', `${meio.opacidade} vs ${lado.opacidade}`);

  if (atras.opacidade === 0) ok('o que está a dois passos some por trás');
  else bad('o de trás continua visível', atras.opacidade);

  if (meio.camada > lado.camada && lado.camada > atras.camada) ok('o do meio desenha por cima');
  else bad('camadas fora de ordem', [meio.camada, lado.camada, atras.camada].join(', '));

  // zIndex fracionário é ignorado no Android.
  const inteiras = [meio, lado, atras].every((p) => Number.isInteger(p.camada));
  if (inteiras) ok('as camadas são inteiras');
  else bad('camada fracionária');

  // Nada pode sair com escala zero ou negativa: o cartão sumiria de vez em
  // vez de ir para trás.
  const extremos = [0, 1, 2, 3, 4].map((i) => posicaoDoCartao(i, 2, 5));
  if (extremos.every((p) => p.escala > 0.5)) ok('nenhum cartão encolhe até desaparecer');
  else bad('escala pequena demais', extremos.map((p) => p.escala).join(', '));
}

{
  // Durante o arrasto tudo é fracionário: o carrossel tem de estar ENTRE dois
  // estados, e não pular de um para o outro.
  const meio = posicaoDoCartao(2, 2, 5, 0);
  const meioArrastado = posicaoDoCartao(2, 2, 5, 0.5);
  const vizinho = posicaoDoCartao(3, 2, 5, 0.5);

  if (meioArrastado.escala < meio.escala) ok('no meio do arrasto o cartão central já encolheu');
  else bad('o central não reage ao arrasto');

  if (Math.abs(meioArrastado.escala - vizinho.escala) < 0.01) {
    ok('na metade do arrasto os dois cartões estão do mesmo tamanho');
  } else bad('a troca não é simétrica', `${meioArrastado.escala} vs ${vizinho.escala}`);
}

/* -------------------------------------------------- quem é desenhado */
{
  const v = visiveis(2, 20);
  if (v.length === 5) ok('numa lista longa só cinco cartões são desenhados');
  else bad('desenhando demais', v.length);

  if (v.includes(2) && v.includes(1) && v.includes(3)) ok('o ativo e os vizinhos entram');
  else bad('faltou vizinho', v.join(','));

  // Numa lista longa, os desenhados não podem repetir — repetir significa que
  // o mesmo cartão apareceria em dois lugares ao mesmo tempo.
  if (new Set(v).size === v.length) ok('nenhum cartão é desenhado duas vezes');
  else bad('cartão repetido', v.join(','));

  const v2 = visiveis(0, 20);
  if (v2.includes(19) && v2.includes(18)) ok('com o primeiro ativo, os últimos entram pela esquerda');
  else bad('o anel não fecha na lista de desenhados', v2.join(','));

  if (visiveis(0, 3).length === 3) ok('lista curta desenha todo mundo');
  else bad('lista curta', visiveis(0, 3).length);

  if (visiveis(0, 0).length === 0) ok('lista vazia não desenha nada');
  else bad('lista vazia desenhou algo');
}

/* ------------------------------------------------- para onde vai ao soltar */
{
  const L = 200;

  if (destinoAoSoltar(2, -L, 0, L, 5) === 3) ok('arrastar uma largura para a esquerda avança um');
  else bad('avanço', destinoAoSoltar(2, -L, 0, L, 5));

  if (destinoAoSoltar(2, L, 0, L, 5) === 1) ok('arrastar para a direita volta um');
  else bad('retrocesso', destinoAoSoltar(2, L, 0, L, 5));

  if (destinoAoSoltar(2, -L * 0.2, 0, L, 5) === 2) ok('arrasto curto e lento volta para onde estava');
  else bad('arrasto curto trocou', destinoAoSoltar(2, -L * 0.2, 0, L, 5));

  // O lance rápido: pouco arrasto, muita velocidade. Exigir meia largura aqui
  // faz o gesto parecer que não pegou.
  if (destinoAoSoltar(2, -L * 0.1, -1200, L, 5) === 3) ok('lance rápido e curto ainda vira o cartão');
  else bad('lance rápido não pegou', destinoAoSoltar(2, -L * 0.1, -1200, L, 5));

  // E não pode atravessar meia lista: ninguém consegue mirar assim.
  const longe = destinoAoSoltar(2, -L * 0.1, -9000, L, 20);
  if (longe === 3) ok('lance muito forte ainda anda só um');
  else bad('o lance forte atravessou a lista', longe);

  // A volta do anel nas duas pontas.
  if (destinoAoSoltar(4, -L, 0, L, 5) === 0) ok('passar do último volta ao primeiro');
  else bad('não deu a volta para a frente', destinoAoSoltar(4, -L, 0, L, 5));

  if (destinoAoSoltar(0, L, 0, L, 5) === 4) ok('voltar do primeiro leva ao último');
  else bad('não deu a volta para trás', destinoAoSoltar(0, L, 0, L, 5));

  // Nunca pode devolver índice fora da lista — viraria cartão em branco.
  const todos = [];
  for (let a = 0; a < 5; a++) {
    for (const arr of [-3 * L, -L, 0, L, 3 * L]) {
      for (const vel of [-2000, 0, 2000]) todos.push(destinoAoSoltar(a, arr, vel, L, 5));
    }
  }
  if (todos.every((i) => Number.isInteger(i) && i >= 0 && i < 5)) ok('o destino é sempre um índice válido');
  else bad('destino inválido', [...new Set(todos)].join(','));

  if (destinoAoSoltar(0, -L, 0, L, 0) === 0) ok('lista vazia não quebra ao soltar');
  else bad('lista vazia ao soltar');
}

console.log(`\n${pass} passaram, ${fail} falharam\n`);
process.exit(fail > 0 ? 1 : 0);
