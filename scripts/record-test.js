/**
 * Testes da política de gravação de aula.
 *
 * O defeito que importa aqui não é visível: é o trecho que SOME. A pessoa grava
 * cinquenta minutos, a rede cai no meio, e a nota sai completa por fora e com
 * um buraco por dentro — ela estuda por essa nota e descobre na prova.
 *
 * Por isso os dois alvos principais:
 *   1. o pedaço que falhou vira MARCA VISÍVEL no texto, nunca silêncio;
 *   2. a ordem da fila é a ordem da aula, porque a pista de um trecho são as
 *      últimas palavras do anterior — fora de ordem, o mesmo nome próprio sai
 *      escrito de três jeitos diferentes.
 */
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../src/features/transcription/gravacao.ts'), 'utf8');
const { outputText } = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const mod = { exports: {} };
new Function('module', 'exports', outputText)(mod, mod.exports);
const {
  SEGUNDOS_POR_PEDACO,
  AUDIO_DE_FALA,
  bytesDe,
  segundosQueCabem,
  proximoParaEnviar,
  pistaPara,
  montarTexto,
  progressoDe,
  relogio,
  minutosEmPalavras,
} = mod.exports;

let pass = 0;
let fail = 0;
const ok = (n) => { pass++; console.log('  OK   ' + n); };
const bad = (n, d) => { fail++; console.log('  FAIL ' + n + (d !== undefined ? ' -> ' + d : '')); };
const eq = (n, a, b) => (a === b ? ok(n) : bad(n, `esperava ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`));

const p = (indice, estado, texto = '', tentativas = 0) => ({
  indice,
  uri: `f${indice}.m4a`,
  segundos: SEGUNDOS_POR_PEDACO,
  estado,
  texto,
  tentativas,
});

console.log('\nGravação de aula\n');

/* ------------------------------------------------------------ o formato */
eq('16 kHz, que é o que o Whisper usa por dentro', AUDIO_DE_FALA.sampleRate, 16000);
eq('mono: estéreo dobra os bytes para o mesmo resultado', AUDIO_DE_FALA.numberOfChannels, 1);
eq('m4a, aceito pela OpenAI', AUDIO_DE_FALA.extension, '.m4a');
{
  // A conta que justifica o formato: uma aula de 50 minutos precisa caber no
  // 4G de quem está na faculdade, e no limite de 25 MB da OpenAI por arquivo.
  const aula = bytesDe(50 * 60);
  if (aula < 15 * 1024 * 1024) ok(`50 minutos dão ${(aula / 1024 / 1024).toFixed(1)} MB`);
  else bad('a aula inteira ficou grande demais', aula);

  const pedaco = bytesDe(SEGUNDOS_POR_PEDACO);
  if (pedaco < 25 * 1024 * 1024) ok('e cada pedaço fica muito abaixo do limite de 25 MB da OpenAI');
  else bad('pedaço acima do limite', pedaco);
}

/* --------------------------------------------------------------- o disco */
{
  // Ser morto por falta de disco no meio da aula perde o que ainda não subiu.
  // A margem existe para parar ANTES, com aviso.
  const umGiga = 1024 * 1024 * 1024;
  const cabe = segundosQueCabem(umGiga);
  if (cabe > 50 * 60) ok(`1 GB livre dá para ${Math.round(cabe / 60)} minutos`);
  else bad('1 GB deu pouco tempo', cabe);
  if (bytesDe(cabe) < umGiga * 0.92) ok('e sobra folga no disco em vez de encostar no fim');
  else bad('a margem de disco não foi respeitada');
}
eq('disco cheio não deixa gravar nada', segundosQueCabem(0), 0);
eq('disco negativo (erro do sistema) também não', segundosQueCabem(-1), 0);
{
  // Disco quase cheio: a reserva mínima é maior que o livre, e a conta não pode
  // devolver número negativo de segundos.
  const c = segundosQueCabem(10 * 1024 * 1024);
  eq('com 10 MB livres não dá para gravar', c, 0);
}

/* ------------------------------------------------- A ORDEM DA FILA */
{
  const fila = [p(2, 'esperando'), p(0, 'esperando'), p(1, 'esperando')];
  eq('a fila sai na ordem da aula, não na de chegada', proximoParaEnviar(fila).indice, 0);
}
eq('nada esperando, nada a enviar', proximoParaEnviar([p(0, 'pronto'), p(1, 'enviando')]), null);
eq('lista vazia não quebra', proximoParaEnviar([]), null);
{
  // O que falhou volta para o FIM da fila. Insistir no pedaço quebrado
  // enquanto os outros esperam trava a aula inteira num erro que talvez seja
  // só daquele arquivo.
  const fila = [p(0, 'esperando', '', 2), p(1, 'esperando', '', 0)];
  eq('quem já falhou cede a vez a quem nunca tentou', proximoParaEnviar(fila).indice, 1);
}
{
  const fila = [p(0, 'esperando', '', 2), p(1, 'esperando', '', 1)];
  eq('se todos já tentaram, volta a ordem da aula', proximoParaEnviar(fila).indice, 0);
}
eq(
  'quem estourou as tentativas sai da fila',
  proximoParaEnviar([p(0, 'esperando', '', 3)]),
  null
);

/* --------------------------------------------------------------- a pista */
{
  const lista = [
    p(0, 'pronto', 'A mitocôndria é a organela responsável pela respiração celular da célula animal'),
    p(1, 'esperando'),
  ];
  const pista = pistaPara(lista, 1, 5);
  eq('a pista são as últimas palavras do trecho anterior', pista, 'respiração celular da célula animal');
}
eq('o primeiro pedaço não tem pista', pistaPara([p(0, 'esperando')], 0), '');
{
  // Pedaço anterior que ainda não voltou não serve de pista, e o anterior a ele
  // serve: sem isso o trecho seguinte perderia o contexto por causa de um
  // vizinho lento.
  const lista = [p(0, 'pronto', 'primeiro trecho aqui'), p(1, 'enviando'), p(2, 'esperando')];
  eq('pula o pedaço que ainda não voltou', pistaPara(lista, 2, 3), 'primeiro trecho aqui');
}
eq('pedaço vazio não vira pista', pistaPara([p(0, 'pronto', '   '), p(1, 'esperando')], 1), '');

/* ------------------------ O BURACO QUE NÃO PODE SER SILENCIOSO */
{
  const lista = [p(0, 'pronto', 'Primeira parte.'), p(1, 'falhou'), p(2, 'pronto', 'Terceira parte.')];
  const texto = montarTexto(lista);
  if (texto.includes('não foi transcrito')) ok('o trecho que falhou vira marca visível no texto');
  else bad('o buraco ficou silencioso', texto);
  if (texto.includes('Primeira parte.') && texto.includes('Terceira parte.'))
    ok('e o que deu certo continua lá');
  else bad('perdeu texto bom', texto);
  if (texto.indexOf('Primeira') < texto.indexOf('Terceira')) ok('na ordem da aula');
  else bad('fora de ordem', texto);
  if (texto.includes('2 minutos')) ok('e a marca diz em que minuto da aula o buraco está');
  else bad('a marca não localiza o buraco', texto);
}
{
  // Fora de ordem na lista, em ordem no texto: os pedaços chegam conforme a
  // transcrição volta, que não é a ordem em que foram gravados.
  const texto = montarTexto([p(2, 'pronto', 'C'), p(0, 'pronto', 'A'), p(1, 'pronto', 'B')]);
  eq('a montagem ordena pelo índice', texto, 'A\n\nB\n\nC');
}
eq('pedaço ainda gravando não entra no texto', montarTexto([p(0, 'gravando')]), '');
eq('pedaço esperando também não', montarTexto([p(0, 'esperando')]), '');
eq('nenhum pedaço dá texto vazio', montarTexto([]), '');

/* ------------------------------------------------------------ progresso */
{
  const pr = progressoDe([p(0, 'pronto', 'a'), p(1, 'esperando'), p(2, 'falhou'), p(3, 'gravando')]);
  eq('conta os prontos', pr.prontos, 1);
  eq('conta os que falharam', pr.falharam, 1);
  // O que ainda está gravando não entra no total: a barra encheria e esvaziaria
  // a cada corte, e ninguém entende uma barra que anda para trás.
  eq('o que ainda grava fica fora do total', pr.total, 3);
  eq('a fração conta resolvido, e falhar é resolvido', Math.round(pr.fracao * 100), 67);
  eq('e a fila ainda está trabalhando', pr.trabalhando, true);
}
{
  const pr = progressoDe([p(0, 'pronto', 'a'), p(1, 'pronto', 'b')]);
  eq('tudo pronto dá fração 1', pr.fracao, 1);
  eq('e a fila parou', pr.trabalhando, false);
}
eq('sem pedaço nenhum, fração zero e não NaN', progressoDe([]).fracao, 0);

/* ------------------------------------------------------------- relógio */
eq('zero', relogio(0), '00:00');
eq('segundos', relogio(9), '00:09');
eq('minutos', relogio(125), '02:05');
eq('a partir de uma hora, mostra a hora', relogio(3725), '1:02:05');
eq('negativo não vira lixo', relogio(-5), '00:00');
eq('fração de segundo é truncada', relogio(59.9), '00:59');

eq('um minuto', minutosEmPalavras(60), '1 minuto');
eq('vários minutos', minutosEmPalavras(300), '5 minutos');
eq('menos de um minuto é dito assim', minutosEmPalavras(20), 'menos de 1 minuto');

console.log(`\n${pass} passaram, ${fail} falharam\n`);
process.exit(fail === 0 ? 0 : 1);
