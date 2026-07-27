/**
 * Testes do registro de quedas.
 *
 * A propriedade que mais importa aqui não é "ele grava certo", e sim **ele
 * nunca lança**. Um relator que quebra transforma um erro em dois e apaga a
 * pista do primeiro — que é justamente o que se queria descobrir. Por isso boa
 * parte destes testes empurra entrada malformada, armazenamento com defeito e
 * erro que não é Error, e checa apenas que nada explodiu.
 */
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '../src/services/crash-reporter.ts'), 'utf8');

let pass = 0;
let fail = 0;
const ok = (n) => { pass++; console.log('  OK   ' + n); };
const bad = (n, d) => { fail++; console.log('  FAIL ' + n + (d ? ' -> ' + d : '')); };

/**
 * Armazenamento falso. `defeito` faz cada operação lançar, para simular MMKV
 * indisponível — que é um estado real quando o disco está cheio.
 */
function criarStorage(inicial = {}) {
  const dados = { ...inicial };
  return {
    defeito: false,
    getString(k) {
      if (this.defeito) throw new Error('storage quebrado');
      return dados[k];
    },
    set(k, v) {
      if (this.defeito) throw new Error('storage quebrado');
      dados[k] = v;
    },
    remove(k) {
      if (this.defeito) throw new Error('storage quebrado');
      delete dados[k];
    },
    _dados: dados,
  };
}

/** Carrega uma instância nova do módulo, com dublês no lugar do que é nativo. */
function carregar(storage) {
  const stubbed = SRC
    .replace(/import \{ Platform \} from 'react-native';/, "const Platform = { OS: 'android', Version: 34 };")
    .replace(/import Constants from 'expo-constants';/, "const Constants = { expoConfig: { version: '0.1.0' } };")
    .replace(/import \{ storage \} from '@\/storage\/mmkv';/, '');

  const { outputText } = ts.transpileModule(stubbed, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });

  const mod = { exports: {} };
  new Function('module', 'exports', 'storage', outputText)(mod, mod.exports, storage);
  return mod.exports;
}

console.log('\nRegistro de quedas\n');

// ---------------------------------------------------------------- gravação
{
  const s = criarStorage();
  const m = carregar(s);
  m.registrarRota('/note/abc');
  m.anotarQueda(new TypeError('undefined is not a function'), true);

  const lista = m.listarQuedas();
  if (lista.length === 1) ok('grava uma queda'); else bad('grava uma queda', lista.length);
  if (lista[0].nome === 'TypeError') ok('guarda o tipo do erro'); else bad('guarda o tipo do erro', lista[0].nome);
  if (lista[0].rota === '/note/abc') ok('guarda a tela em que aconteceu'); else bad('guarda a tela', lista[0].rota);
  if (lista[0].fatal === true) ok('marca como fatal'); else bad('marca como fatal');
  if (lista[0].sistema === 'android 34') ok('guarda o sistema'); else bad('guarda o sistema', lista[0].sistema);
  if (lista[0].versao === '0.1.0') ok('guarda a versão do app'); else bad('guarda a versão');
}

// ------------------------------------------------------- ordem e limite
{
  const s = criarStorage();
  const m = carregar(s);
  for (let i = 0; i < 40; i += 1) m.anotarQueda(new Error('erro ' + i), false);

  const lista = m.listarQuedas();
  if (lista.length === 15) ok('limita o registro a 15'); else bad('limita a 15', lista.length);
  if (lista[0].mensagem === 'erro 39') ok('mais recente vem primeiro'); else bad('mais recente primeiro', lista[0].mensagem);
}

// --------------------------------------------- marca de "caiu na última vez"
{
  const s = criarStorage();
  const m = carregar(s);

  if (m.caiuNaSessaoAnterior() === false) ok('sem queda, não avisa'); else bad('sem queda, não avisa');

  m.anotarQueda(new Error('x'), false);
  if (m.caiuNaSessaoAnterior() === false) ok('erro não-fatal não liga o aviso'); else bad('não-fatal não avisa');

  m.anotarQueda(new Error('x'), true);
  if (m.caiuNaSessaoAnterior() === true) ok('queda fatal liga o aviso'); else bad('fatal liga o aviso');
  if (m.caiuNaSessaoAnterior() === false) ok('o aviso só aparece uma vez'); else bad('aviso repetiu');
}

// ------------------------------------------------ nunca lançar: entrada ruim
{
  const s = criarStorage();
  const m = carregar(s);

  const entradas = [
    ['string solta', 'só um texto'],
    ['null', null],
    ['undefined', undefined],
    ['número', 42],
    ['objeto sem message', { qualquer: 'coisa' }],
    ['erro sem mensagem', new Error()],
  ];

  for (const [rotulo, valor] of entradas) {
    try {
      m.anotarQueda(valor, true);
      ok('não lança com ' + rotulo);
    } catch (e) {
      bad('não lança com ' + rotulo, e.message);
    }
  }

  // Objeto circular quebraria JSON.stringify se ele fosse serializado inteiro.
  const circular = { nome: 'circular' };
  circular.self = circular;
  try {
    m.anotarQueda(circular, true);
    ok('não lança com objeto circular');
  } catch (e) {
    bad('não lança com objeto circular', e.message);
  }

  if (m.listarQuedas().length > 0) ok('as entradas ruins ainda viram registro'); else bad('entradas ruins sumiram');
}

// -------------------------------------- nunca lançar: armazenamento com defeito
{
  const s = criarStorage();
  const m = carregar(s);
  s.defeito = true;

  try {
    m.anotarQueda(new Error('durante o defeito'), true);
    ok('não lança quando o armazenamento falha ao gravar');
  } catch (e) {
    bad('não lança com armazenamento quebrado', e.message);
  }

  try {
    const r = m.listarQuedas();
    if (Array.isArray(r)) ok('listar devolve lista mesmo com defeito'); else bad('listar não devolveu lista');
  } catch (e) {
    bad('listar não lança com defeito', e.message);
  }

  try {
    m.limparQuedas();
    ok('limpar não lança com defeito');
  } catch (e) {
    bad('limpar não lança com defeito', e.message);
  }

  try {
    if (m.caiuNaSessaoAnterior() === false) ok('aviso não lança com defeito'); else bad('aviso errado com defeito');
  } catch (e) {
    bad('aviso não lança com defeito', e.message);
  }
}

// ------------------------------------------------ registro corrompido no disco
{
  const s = criarStorage({ 'markee.crashes': '{isso não é json[[[' });
  const m = carregar(s);

  let lista;
  try {
    lista = m.listarQuedas();
    if (Array.isArray(lista) && lista.length === 0) ok('registro corrompido vira lista vazia');
    else bad('registro corrompido', JSON.stringify(lista));
  } catch (e) {
    bad('registro corrompido não lança', e.message);
  }

  // O ponto: corrupção não pode impedir de anotar a PRÓXIMA queda.
  m.anotarQueda(new Error('depois da corrupção'), true);
  if (m.listarQuedas().length === 1) ok('volta a gravar depois de corrompido');
  else bad('não voltou a gravar depois de corrompido');
}

// ------------------------------------ JSON válido mas do tipo errado no disco
{
  const s = criarStorage({ 'markee.crashes': '{"nao":"e um array"}' });
  const m = carregar(s);
  const lista = m.listarQuedas();
  if (Array.isArray(lista) && lista.length === 0) ok('objeto no lugar de lista é ignorado');
  else bad('objeto no lugar de lista', JSON.stringify(lista));
}

// ------------------------------------------------- encadeia o handler original
{
  const s = criarStorage();
  const m = carregar(s);

  let chamouOriginal = false;
  let recebeuFatal = null;
  const original = (_erro, fatal) => {
    chamouOriginal = true;
    recebeuFatal = fatal;
  };

  let instalado = null;
  globalThis.ErrorUtils = {
    getGlobalHandler: () => original,
    setGlobalHandler: (h) => {
      instalado = h;
    },
  };

  m.instalarRelatorDeQuedas();
  if (typeof instalado === 'function') ok('instala o handler global'); else bad('não instalou o handler');

  instalado(new Error('caiu de verdade'), true);

  if (chamouOriginal) ok('continua chamando o handler original (tela vermelha em dev)');
  else bad('engoliu o erro: o handler original não foi chamado');
  if (recebeuFatal === true) ok('repassa o sinal de fatal'); else bad('não repassou fatal', recebeuFatal);
  if (m.listarQuedas().length === 1) ok('a queda capturada foi gravada'); else bad('não gravou a queda capturada');

  delete globalThis.ErrorUtils;
}

// ---------------------------------- instalar sem ErrorUtils não pode quebrar
{
  const s = criarStorage();
  const m = carregar(s);
  delete globalThis.ErrorUtils;

  try {
    m.instalarRelatorDeQuedas();
    ok('instalar sem ErrorUtils não lança');
  } catch (e) {
    bad('instalar sem ErrorUtils', e.message);
  }
}

// --------------------------------------------- instalar duas vezes é inofensivo
{
  const s = criarStorage();
  const m = carregar(s);

  let vezes = 0;
  globalThis.ErrorUtils = {
    getGlobalHandler: () => undefined,
    setGlobalHandler: () => {
      vezes += 1;
    },
  };

  m.instalarRelatorDeQuedas();
  m.instalarRelatorDeQuedas();
  m.instalarRelatorDeQuedas();

  if (vezes === 1) ok('instalar de novo não empilha handler'); else bad('empilhou handler', vezes);
  delete globalThis.ErrorUtils;
}

console.log(`\n${pass} passaram, ${fail} falharam\n`);
process.exit(fail > 0 ? 1 : 0);
