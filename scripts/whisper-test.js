/**
 * Testes da transcrição no aparelho.
 *
 * O que se protege aqui tem duas caras.
 *
 * A primeira é MEMÓRIA. Escolher um modelo grande demais não deixa o app lento:
 * deixa o app MORTO, com o Android matando o processo no meio da aula que a
 * pessoa já gravou. É a única falha desta pasta que destrói trabalho já feito,
 * e por isso o orçamento de RAM é testado nos dois sentidos — que reprova o que
 * não cabe e que não reprova o que cabe.
 *
 * A segunda é HONESTIDADE DO NÚMERO. Os tamanhos dos arquivos viram barra de
 * progresso e conferência de download; a estimativa de tempo vira a decisão de
 * esperar ou não. Um número inventado aqui não quebra nada — só mente para a
 * pessoa, que é pior, porque ninguém percebe.
 */
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../src/features/transcription/whisper-local.ts'), 'utf8');
const { outputText } = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const mod = { exports: {} };
new Function('module', 'exports', outputText)(mod, mod.exports);

const {
  MODELOS,
  ORDEM,
  RECOMENDADO,
  urlDoModelo,
  memoriaDe,
  ramNecessaria,
  cabeNaMemoria,
  espacoNecessario,
  escolherModelo,
  opcoesDeTranscricao,
  opcoesDeContexto,
  estimarSegundos,
  emPalavras,
  tamanhoEmPalavras,
  avisoDoModelo,
} = mod.exports;

let pass = 0;
let fail = 0;
const ok = (n) => { pass++; console.log('  OK   ' + n); };
const bad = (n, d) => { fail++; console.log('  FAIL ' + n + (d !== undefined ? ' -> ' + d : '')); };

const GB = 1024 ** 3;

console.log('\nTranscrição no aparelho\n');

/* --------------------------------------------------------------- catálogo */
{
  if (ORDEM.length === 4 && ORDEM.every((id) => MODELOS[id])) ok('os quatro modelos estão no catálogo');
  else bad('catálogo incompleto', ORDEM.join(','));

  // A ordem é usada para rebaixar do maior para o menor. Fora de ordem, o
  // rebaixamento entregaria um modelo MAIOR do que o que já não coube.
  const crescente = ORDEM.every((id, i) => i === 0 || MODELOS[ORDEM[i - 1]].bytes < MODELOS[id].bytes);
  if (crescente) ok('a ordem vai do menor para o maior arquivo');
  else bad('a ordem do catálogo não é crescente');

  const custoCrescente = ORDEM.every((id, i) => i === 0 || MODELOS[ORDEM[i - 1]].custo < MODELOS[id].custo);
  if (custoCrescente) ok('modelo maior custa mais tempo, sem exceção');
  else bad('há modelo maior mais barato que um menor');

  // O pedido foi "medium quantizado ao máximo possível". No repositório oficial
  // o medium só tem q5_0 e q8_0 — conferi os seis nomes. q5_0 é a resposta.
  if (MODELOS.medium.arquivo === 'ggml-medium-q5_0.bin') ok('o medium usa a quantização mais forte que existe (q5_0)');
  else bad('quantização do medium', MODELOS.medium.arquivo);

  if (ORDEM.every((id) => urlDoModelo(MODELOS[id]).startsWith('https://'))) ok('todo modelo baixa por https');
  else bad('há modelo baixando sem https');

  // O recomendado é o que a maioria vai levar, então ele carrega duas
  // promessas: cabe em qualquer telefone, e termina uma aula em menos tempo do
  // que a própria aula. Um recomendado que não cumpre as duas manda a maioria
  // para a pior experiência possível — e ninguém volta para trocar de modelo.
  const rec = MODELOS[RECOMENDADO];
  if (rec) ok(`o recomendado é o ${rec.nome} (${RECOMENDADO})`);
  else bad('o recomendado não está no catálogo', RECOMENDADO);

  // 1 GB é o piso realista de um telefone Android em uso hoje.
  if (cabeNaMemoria(rec, 1 * GB)) ok('o recomendado cabe até num aparelho de 1 GB');
  else bad('o recomendado não cabe em 1 GB', ramNecessaria(rec));

  if (estimarSegundos(50 * 60, rec) < 50 * 60) ok('o recomendado transcreve mais rápido que o tempo real');
  else bad('o recomendado é mais lento que a própria aula');

  if (avisoDoModelo(rec, 50 * 60) === null) ok('o recomendado não precisa de aviso de lentidão');
  else bad('o recomendado precisa de aviso — então não devia ser o recomendado');
}

/* ----------------------------------------------------------- memória */
{
  if (memoriaDe(MODELOS.medium) > MODELOS.medium.bytes) ok('o pico de memória é maior que o arquivo');
  else bad('pico de memória menor que o arquivo');

  // O número que importa: o medium exige mais de 3 GB de RAM TOTAL.
  const precisa = ramNecessaria(MODELOS.medium) / GB;
  if (precisa > 3 && precisa < 3.5) ok(`o medium exige ~${precisa.toFixed(1)} GB de RAM total`);
  else bad('RAM exigida pelo medium', precisa.toFixed(2) + ' GB');

  const casos = [
    ['medium', 2 * GB, false, 'telefone de 2 GB reprova no medium'],
    ['medium', 4 * GB, true, 'telefone de 4 GB roda o medium'],
    ['small', 2 * GB, true, 'telefone de 2 GB roda o small'],
    ['small', 1 * GB, false, 'telefone de 1 GB reprova no small'],
    ['tiny', 1 * GB, true, 'telefone de 1 GB roda o tiny'],
  ];
  const erros = casos.filter(([id, ram, esperado]) => cabeNaMemoria(MODELOS[id], ram) !== esperado);
  if (erros.length === 0) ok('o orçamento de memória aceita e reprova nos lugares certos');
  else bad('orçamento de memória errado', erros.map((c) => c[3]).join('; '));

  // Aparelho que não informa a memória não pode ser bloqueado: barrar por falta
  // de informação deixaria sem transcrição quem talvez rodasse tudo.
  if (ORDEM.every((id) => cabeNaMemoria(MODELOS[id], 0))) ok('memória desconhecida não bloqueia ninguém');
  else bad('memória desconhecida bloqueou algum modelo');

  if (espacoNecessario(MODELOS.medium) > MODELOS.medium.bytes) ok('o download pede folga de disco além do arquivo');
  else bad('sem folga de disco');
}

/* ------------------------------------------------- escolha e rebaixamento */
{
  const bom = escolherModelo('medium', 8 * GB);
  if (bom.modelo.id === 'medium' && !bom.rebaixado && bom.motivo === '') ok('cabendo, entrega o que foi pedido, sem motivo');
  else bad('rebaixou sem precisar', JSON.stringify(bom));

  const curto = escolherModelo('medium', 2 * GB);
  if (curto.modelo.id === 'small' && curto.rebaixado) ok('não cabendo o medium, cai para o small — o maior que cabe');
  else bad('rebaixamento errado', curto.modelo.id);

  if (/medium|Caprichado/i.test(curto.motivo) && /GB/.test(curto.motivo)) ok('o motivo diz o que foi pedido e quanta memória há');
  else bad('motivo vago', curto.motivo);

  // Nunca sobe: pedir pequeno e receber grande estouraria a memória de quem
  // escolheu pequeno de propósito.
  const subiu = ORDEM.filter((id) => {
    const e = escolherModelo(id, 64 * GB);
    return ORDEM.indexOf(e.modelo.id) > ORDEM.indexOf(id);
  });
  if (subiu.length === 0) ok('nenhum pedido é atendido com um modelo maior que o pedido');
  else bad('rebaixamento subiu de modelo', subiu.join(','));

  // Chão: mesmo num aparelho absurdo, devolve algo utilizável em vez de nada.
  const chao = escolherModelo('medium', 64 * 1024 * 1024);
  if (chao.modelo.id === 'tiny' && chao.rebaixado && chao.motivo) ok('aparelho minúsculo ainda recebe o tiny, com aviso');
  else bad('chão do rebaixamento', JSON.stringify(chao));

  // Pedir tiny num aparelho minúsculo não é rebaixamento — não há o que avisar.
  if (escolherModelo('tiny', 64 * 1024 * 1024).rebaixado === false) ok('pedir o tiny e receber o tiny não conta como rebaixamento');
  else bad('marcou rebaixamento sem ter rebaixado');
}

/* ------------------------------------------------------------- as opções */
{
  const o = opcoesDeTranscricao();

  if (o.language === 'pt') ok('o idioma vai fixo, poupando a passada de detecção');
  else bad('idioma não fixado', o.language);

  // O whisper.rn só liga busca em feixe se o campo vier > 0. Presente, mesmo
  // que com valor baixo, multiplicaria o trabalho do decodificador.
  if (!('beamSize' in o)) ok('sem beamSize: fica na decodificação gulosa, que é a rápida');
  else bad('beamSize presente', o.beamSize);

  if (o.bestOf === 2) ok('bestOf 2: mantém a rede de segurança por 2/5 do preço do padrão');
  else bad('bestOf', o.bestOf);

  // De propósito ausente: o nativo lê hardware_concurrency e decide melhor do
  // que qualquer constante que o JavaScript pudesse chutar.
  if (!('maxThreads' in o)) ok('sem maxThreads: quem decide é o nativo, que enxerga os núcleos');
  else bad('maxThreads fixado no JavaScript', o.maxThreads);

  if (!('tokenTimestamps' in o) || o.tokenTimestamps === false) ok('sem marcação de tempo por palavra, que custa caro e não serve à nota');
  else bad('tokenTimestamps ligado');

  if (o.translate === false) ok('não traduz');
  else bad('tradução ligada');

  if (!('prompt' in o)) ok('sem pista, nenhum prompt vazio é enviado');
  else bad('prompt vazio enviado');

  if (opcoesDeTranscricao('a última frase').prompt === 'a última frase') ok('a pista do trecho anterior vira o prompt inicial');
  else bad('a pista não virou prompt');

  // Atenção fundida só onde a biblioteca recomenda: com GPU.
  if (opcoesDeContexto('ios').useFlashAttn === true) ok('no iOS, com Metal, a atenção fundida entra');
  else bad('flash attn desligado no iOS');

  if (opcoesDeContexto('android').useFlashAttn === false) ok('no Android, só CPU, a atenção fundida fica fora');
  else bad('flash attn ligado no Android, contra a recomendação da biblioteca');
}

/* -------------------------------------------------------- as estimativas */
{
  const aula = 50 * 60;

  if (estimarSegundos(aula, MODELOS.medium) > aula) ok('o medium é estimado como mais lento que o tempo real');
  else bad('o medium estimado como mais rápido que o áudio');

  if (estimarSegundos(aula, MODELOS.tiny) < aula) ok('o tiny é estimado como mais rápido que o tempo real');
  else bad('o tiny estimado como lento');

  // O valor medido tem de mandar: o mesmo modelo roda em velocidades muito
  // diferentes em dois telefones, e nenhuma tabela minha adivinha qual é qual.
  const medido = estimarSegundos(aula, MODELOS.medium, 0.5);
  if (medido === aula * 0.5) ok('havendo medição, ela substitui a tabela');
  else bad('a medição foi ignorada', medido);

  if (estimarSegundos(aula, MODELOS.medium, 0) === estimarSegundos(aula, MODELOS.medium)) ok('medição zerada não é usada como se fosse instantânea');
  else bad('medição zero virou estimativa de zero');

  if (estimarSegundos(-5, MODELOS.tiny) === 0) ok('duração negativa não vira tempo negativo');
  else bad('estimativa negativa');

  const palavras = [
    [30, 'menos de um minuto'],
    [60, '1 minuto'],
    [61, '2 minutos'],
    [3600, '1 hora'],
    [5400, '1 hora e 30 min'],
  ];
  const ruins = palavras.filter(([s, esperado]) => emPalavras(s) !== esperado);
  if (ruins.length === 0) ok('o tempo em palavras arredonda para cima, sempre');
  else bad('tempo em palavras', ruins.map(([s]) => s + ' -> ' + emPalavras(s)).join('; '));

  if (tamanhoEmPalavras(MODELOS.medium.bytes) === '514 MB') ok('o tamanho do medium aparece como 514 MB');
  else bad('tamanho do medium', tamanhoEmPalavras(MODELOS.medium.bytes));

  // O aviso existe para a pessoa saber ANTES de baixar meio giga.
  const aviso = avisoDoModelo(MODELOS.medium, aula);
  if (aviso && /mais tempo do que a própria aula/.test(aviso)) ok('o medium avisa que demora mais que a aula');
  else bad('faltou o aviso do medium', aviso);

  if (avisoDoModelo(MODELOS.tiny, aula) === null) ok('modelo rápido não enche a tela de aviso');
  else bad('aviso desnecessário no tiny');

  // Num aparelho rápido de verdade, o medium para de merecer aviso.
  if (avisoDoModelo(MODELOS.medium, aula, 0.4) === null) ok('medição rápida cala o aviso do medium');
  else bad('avisou apesar da medição rápida');
}

/* ------------------------------- os tamanhos, conferidos no servidor real */
/**
 * Os bytes do catálogo saíram de um `HEAD` no HuggingFace, e não de tabela de
 * README. Isto confere se continuam valendo.
 *
 * Rede fora do ar, tempo esgotado, HuggingFace de mau humor: tudo isso PULA em
 * vez de reprovar. Um teste que quebra o build porque um servidor de terceiros
 * caiu não protege nada — ensina a ignorar o vermelho. Só o desacordo de
 * verdade, com o servidor respondendo, é falha.
 *
 * E o desacordo importa pouco no funcionamento e muito na conversa: desde o
 * selo de download, o número daqui não decide mais se o modelo é válido. Ele
 * decide a escala da barra de progresso, o aviso de disco cheio — e o que eu
 * afirmo sobre o tamanho do download.
 */
async function conferirTamanhos() {
  console.log('\nTamanhos, contra o HuggingFace\n');

  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), 20000);

  try {
    const erros = [];
    for (const id of ORDEM) {
      const m = MODELOS[id];
      const r = await fetch(urlDoModelo(m), { method: 'HEAD', signal: controle.signal });
      if (!r.ok) throw new Error(`${m.arquivo}: HTTP ${r.status}`);

      const real = Number(r.headers.get('content-length'));
      if (!Number.isFinite(real) || real <= 0) throw new Error(`${m.arquivo}: sem content-length`);
      if (real !== m.bytes) erros.push(`${m.arquivo}: catálogo ${m.bytes}, servidor ${real}`);
    }

    if (erros.length === 0) ok('os quatro tamanhos batem com o servidor');
    else bad('tamanho fora do que o servidor informa', erros.join('; '));
  } catch (e) {
    console.log('  PULA sem conseguir falar com o HuggingFace (' + e.message + ')');
  } finally {
    clearTimeout(relogio);
  }
}

conferirTamanhos().then(() => {
  console.log(`\n${pass} passaram, ${fail} falharam\n`);
  process.exit(fail > 0 ? 1 : 0);
});
