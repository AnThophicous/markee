/**
 * Testes da separação de aula transcrita.
 *
 * O que se está protegendo aqui é uma coisa só: NUNCA PERDER O QUE FOI DITO.
 *
 * A classificação é palpite de um modelo, e palpite erra de três jeitos —
 * devolve lixo, devolve pela metade, ou devolve num formato que não é o
 * combinado. Os três acontecem em produção, e o terceiro é o pior: uma resposta
 * que parece perfeita mas cobre 60% da aula passa em qualquer conferência de
 * formato, e a pessoa só descobre semanas depois, quando procura na nota algo
 * que o professor falou e não está lá.
 */
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../src/features/transcription/classify.ts'), 'utf8');
const { outputText } = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const mod = { exports: {} };
new Function('module', 'exports', outputText)(mod, mod.exports);
const { promptDeClassificacao, lerClassificacao, oQueFicouDeFora, paraMarkdown } = mod.exports;

let pass = 0;
let fail = 0;
const ok = (n) => { pass++; console.log('  OK   ' + n); };
const bad = (n, d) => { fail++; console.log('  FAIL ' + n + (d !== undefined ? ' -> ' + d : '')); };

console.log('\nSeparar aula de conversa fiada\n');

const AULA =
  'Bom dia pessoal senta a í. A mitocôndria é a organela responsável pela ' +
  'respiração celular. Ela tem duas membranas. A prova vai ser dia doze de agosto. ' +
  'Fulano para de conversar. Estudem as páginas quarenta a cinquenta.';

const boa = JSON.stringify({
  trechos: [
    { texto: 'Bom dia pessoal senta aí.', tipo: 'ruido' },
    { texto: 'A mitocôndria é a organela responsável pela respiração celular. Ela tem duas membranas.', tipo: 'conteudo' },
    { texto: 'A prova vai ser dia doze de agosto.', tipo: 'tarefa', prazo: '2026-08-12' },
    { texto: 'Fulano para de conversar.', tipo: 'ruido' },
    { texto: 'Estudem as páginas quarenta a cinquenta.', tipo: 'tarefa' },
  ],
});

/* ------------------------------------------------------------ a instrução */
{
  const p = promptDeClassificacao('texto qualquer', new Date('2026-07-28T12:00:00Z'));

  if (p.includes('2026-07-28')) ok('a instrução informa a data de hoje, para o prazo ser resolvido');
  else bad('a data de hoje não foi para a instrução');

  if (p.includes('texto qualquer')) ok('a transcrição entra na instrução');
  else bad('a transcrição não entrou');

  if (/não descarte|Não descarte/i.test(p)) ok('a instrução proíbe descartar texto');
  else bad('falta a proibição de descartar');

  if (/não resuma|COPIE/i.test(p)) ok('a instrução manda copiar, não resumir');
  else bad('falta a ordem de copiar');

  for (const tipo of ['conteudo', 'tarefa', 'ruido']) {
    if (!p.includes(tipo)) bad('a instrução não descreve o tipo ' + tipo);
  }
  ok('a instrução descreve os três tipos');
}

/* --------------------------------------------------------- resposta boa */
{
  const t = lerClassificacao(boa, AULA);
  if (t.length === 5) ok('lê os cinco trechos de uma resposta boa');
  else bad('quantidade de trechos', t.length);

  if (t[2].tipo === 'tarefa' && t[2].prazo === '2026-08-12') ok('a data da prova é reconhecida');
  else bad('prazo', JSON.stringify(t[2]));

  if (t.filter((x) => x.tipo === 'ruido').length === 2) ok('a chamada e a bronca viram ruído');
  else bad('ruído mal contado');
}

/* --------------------------------- o modelo não devolve o que foi pedido */
{
  // Cerca de markdown: o caso mais comum de todos.
  const comCerca = '```json\n' + boa + '\n```';
  if (lerClassificacao(comCerca, AULA).length === 5) ok('resposta embrulhada em cerca de markdown é lida');
  else bad('a cerca de markdown atrapalhou');

  // Saudação antes, comentário depois.
  const falante = 'Claro! Aqui está a classificação:\n' + boa + '\nEspero ter ajudado.';
  if (lerClassificacao(falante, AULA).length === 5) ok('saudação antes e depois não atrapalham');
  else bad('a saudação atrapalhou');

  const ambos = 'Segue:\n```json\n' + boa + '\n```\nQualquer coisa é só falar.';
  if (lerClassificacao(ambos, AULA).length === 5) ok('cerca e saudação juntas ainda são lidas');
  else bad('cerca + saudação atrapalharam');
}

/* ------------------------- resposta quebrada devolve o texto INTEIRO */
{
  const quebradas = [
    ['vazia', ''],
    ['só texto', 'Desculpe, não consegui processar.'],
    ['JSON cortado no meio', '{"trechos":[{"texto":"a mitoc'],
    ['JSON válido sem trechos', '{"resultado":"ok"}'],
    ['trechos não é lista', '{"trechos":"nenhum"}'],
    ['lista vazia', '{"trechos":[]}'],
    ['lista só com lixo', '{"trechos":[{"nada":1},{"texto":"   "}]}'],
  ];

  const ruins = [];
  for (const [nome, resposta] of quebradas) {
    const t = lerClassificacao(resposta, AULA);
    const juntou = t.map((x) => x.texto).join(' ');
    if (t.length !== 1 || juntou !== AULA.trim()) ruins.push(nome);
  }
  if (ruins.length === 0) ok('toda resposta quebrada devolve a transcrição inteira');
  else bad('respostas quebradas que perderam texto', ruins.join(', '));

  if (lerClassificacao('', '').length === 0) ok('transcrição vazia não inventa trecho');
  else bad('inventou trecho do nada');

  // Nada aqui pode lançar: isto roda depois de uma gravação que já custou
  // dinheiro, e uma exceção perderia a aula inteira.
  let lancou = false;
  for (const entrada of [null, undefined, '{]', '[]', '{"trechos":[null]}']) {
    try { lerClassificacao(entrada, AULA); } catch { lancou = true; }
  }
  if (!lancou) ok('nenhuma entrada estranha lança exceção');
  else bad('alguma entrada lançou');
}

/* ------------------------------- O CASO PERIGOSO: cobertura pela metade */
{
  // Formato impecável, mas o modelo devolveu só a primeira frase. Este é o
  // erro que passa por qualquer conferência de formato.
  const pelaMetade = JSON.stringify({
    trechos: [{ texto: 'Bom dia pessoal senta aí.', tipo: 'ruido' }],
  });

  const t = lerClassificacao(pelaMetade, AULA);
  const juntou = t.map((x) => x.texto).join(' ');

  if (juntou.includes('mitocôndria')) ok('conteúdo engolido pelo modelo é devolvido');
  else bad('a resposta pela metade perdeu a matéria');

  if (juntou.includes('prova')) ok('a tarefa engolida também volta');
  else bad('perdeu a prova');

  if (t.length > 1) ok('o que ficou de fora entra como trecho a mais');
  else bad('não acrescentou o que faltou');
}

{
  // E o contrário: cobertura completa não pode disparar o alarme, senão o
  // texto apareceria duas vezes na nota.
  const t = lerClassificacao(boa, AULA);
  const vezes = (t.map((x) => x.texto).join(' ').match(/mitocôndria/g) || []).length;
  if (vezes === 1) ok('resposta completa não duplica o texto');
  else bad('texto duplicado', vezes + ' vezes');

  if (oQueFicouDeFora([{ texto: AULA, tipo: 'conteudo' }], AULA) === null) {
    ok('cobertura total não acusa falta');
  } else bad('acusou falta com cobertura total');

  // Pontuação e junção de fala mudam o texto sem perder conteúdo — não podem
  // disparar o alarme, senão ele vira ruído que se aprende a ignorar.
  const reescrito = AULA.replace(/\./g, '').replace(/\s+/g, '  ');
  if (oQueFicouDeFora([{ texto: reescrito, tipo: 'conteudo' }], AULA) === null) {
    ok('diferença de pontuação e espaço não acusa falta');
  } else bad('a pontuação disparou o alarme');
}

/* ------------------------------------------------------------ o markdown */
{
  const md = paraMarkdown(lerClassificacao(boa, AULA));

  if (md.indexOf('Para fazer') < md.indexOf('Aula')) ok('as tarefas vêm antes da matéria');
  else bad('ordem das seções');

  if (md.includes('- [ ] A prova vai ser dia doze de agosto. _(2026-08-12)_')) {
    ok('a tarefa vira caixa marcável com a data ao lado');
  } else bad('formato da tarefa');

  if (md.includes('mitocôndria')) ok('a matéria entra no corpo da nota');
  else bad('a matéria sumiu do markdown');

  // O ruído continua no arquivo. Some da vista, não do disco.
  if (md.includes('Fulano para de conversar')) ok('o ruído continua na nota, recolhido no fim');
  else bad('o ruído foi apagado');

  if (md.indexOf('Fulano') > md.indexOf('mitocôndria')) ok('o ruído fica depois da matéria');
  else bad('o ruído ficou na frente');

  // Sem tarefa, não se desenha uma seção vazia com um título órfão.
  const semTarefa = paraMarkdown([{ texto: 'só matéria', tipo: 'conteudo' }]);
  if (!semTarefa.includes('Para fazer')) ok('sem tarefa, não aparece seção de tarefas');
  else bad('seção de tarefas vazia');

  if (paraMarkdown([]) === '') ok('lista vazia gera markdown vazio');
  else bad('markdown de lista vazia', JSON.stringify(paraMarkdown([])));
}

console.log(`\n${pass} passaram, ${fail} falharam\n`);
process.exit(fail > 0 ? 1 : 0);
