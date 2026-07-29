/**
 * Testes da revisão espaçada e da ofensiva.
 *
 * Estes dois são o tipo de código que passa em toda conferência manual e mente
 * devagar. Ninguém revisa uma carta seiscentas vezes para descobrir que o
 * intervalo estourou o inteiro; ninguém troca o fuso do telefone para descobrir
 * que a ofensiva quebrou sozinha às 21h. São defeitos que só aparecem meses
 * depois, na conta de outra pessoa, e por isso são testados aqui.
 *
 * O alvo principal do SM-2 é o PISO da facilidade. Sem ele, a carta que se erra
 * sempre chega a facilidade zero, o intervalo para de crescer e ela volta todo
 * dia para sempre — a fila enche de uma carta só e a pessoa abandona o app.
 *
 * O alvo principal da ofensiva é a regra de que HOJE não conta contra você. Sem
 * ela, o número aparece zerado toda manhã antes do primeiro estudo, e um número
 * que zera sozinho todo dia não motiva ninguém.
 */
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

function carregar(relativo) {
  const src = fs.readFileSync(path.join(__dirname, relativo), 'utf8');
  const { outputText } = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const mod = { exports: {} };
  new Function('module', 'exports', outputText)(mod, mod.exports);
  return mod.exports;
}

const {
  responder,
  proximaRevisao,
  previsao,
  intervaloEmPalavras,
  CARTA_NOVA,
  FACILIDADE_MINIMA,
  FACILIDADE_INICIAL,
} = carregar('../src/features/review/sm2.ts');

const { calcularOfensiva, diaDe, diasAtras, ultimosDias, intensidade } = carregar(
  '../src/features/stats/streak.ts'
);

const { sugerirCartas, sugerirDaAula } = carregar('../src/features/review/extrair.ts');

let pass = 0;
let fail = 0;
const ok = (n) => { pass++; console.log('  OK   ' + n); };
const bad = (n, d) => { fail++; console.log('  FAIL ' + n + (d !== undefined ? ' -> ' + d : '')); };
const eq = (n, a, b) => (a === b ? ok(n) : bad(n, `esperava ${b}, veio ${a}`));

console.log('\nRevisão espaçada\n');

// --- os degraus fixos do começo -------------------------------------------
{
  const um = responder(CARTA_NOVA, 'bom');
  eq('primeiro acerto volta em 1 dia', um.intervalo, 1);
  const dois = responder(um, 'bom');
  eq('segundo acerto volta em 6 dias', dois.intervalo, 6);
  const tres = responder(dois, 'bom');
  // 6 * 2.5 = 15. A facilidade em "bom" (q=4) não muda, então continua 2500.
  eq('terceiro acerto multiplica pela facilidade', tres.intervalo, 15);
  eq('"bom" não mexe na facilidade', tres.facilidade, FACILIDADE_INICIAL);
}

// --- a facilidade sobe e desce --------------------------------------------
{
  eq('"fácil" sobe a facilidade em 0,1', responder(CARTA_NOVA, 'facil').facilidade, 2600);
  eq('"difícil" desce a facilidade em 0,14', responder(CARTA_NOVA, 'dificil').facilidade, 2360);
  eq('"errei" desce a facilidade em 0,8', responder(CARTA_NOVA, 'errei').facilidade, 1700);
}

// --- O PISO: o defeito que envenena a fila --------------------------------
{
  let carta = CARTA_NOVA;
  for (let i = 0; i < 30; i += 1) carta = responder(carta, 'errei');
  eq('errar trinta vezes não passa do piso', carta.facilidade, FACILIDADE_MINIMA);
  if (carta.facilidade > 0) ok('facilidade nunca chega a zero'); else bad('facilidade nunca chega a zero');
  if (carta.intervalo >= 1) ok('carta errada sempre volta no dia seguinte, nunca no mesmo instante');
  else bad('carta errada sempre volta no dia seguinte', carta.intervalo);
}

// --- errar reinicia, mas não apaga o histórico ----------------------------
{
  let carta = responder(responder(responder(CARTA_NOVA, 'bom'), 'bom'), 'bom');
  eq('antes do erro, três repetições', carta.repeticoes, 3);
  const errada = responder(carta, 'errei');
  eq('errar zera as repetições', errada.repeticoes, 0);
  eq('errar volta para 1 dia', errada.intervalo, 1);
  eq('errar conta uma queda', errada.quedas, 1);
  eq('a queda anterior é preservada', responder(errada, 'errei').quedas, 2);
}

// --- o teto: aritmética, não pedagogia ------------------------------------
{
  let carta = CARTA_NOVA;
  for (let i = 0; i < 60; i += 1) carta = responder(carta, 'facil');
  if (carta.intervalo <= 3650) ok('sessenta acertos não estouram o teto de dez anos');
  else bad('sessenta acertos não estouram o teto', carta.intervalo);
  if (Number.isSafeInteger(carta.intervalo)) ok('o intervalo continua inteiro seguro');
  else bad('o intervalo continua inteiro seguro', carta.intervalo);

  const venc = proximaRevisao(carta, Date.now());
  if (Number.isSafeInteger(venc) && venc > Date.now()) ok('a data de vencimento continua um número válido');
  else bad('a data de vencimento continua válida', venc);
}

// --- a facilidade é inteiro, sempre ---------------------------------------
{
  let carta = CARTA_NOVA;
  let inteiros = true;
  for (let i = 0; i < 40; i += 1) {
    carta = responder(carta, ['bom', 'facil', 'dificil', 'errei'][i % 4]);
    if (!Number.isInteger(carta.facilidade) || !Number.isInteger(carta.intervalo)) inteiros = false;
  }
  if (inteiros) ok('facilidade e intervalo nunca viram fração');
  else bad('facilidade e intervalo nunca viram fração');
}

// --- a previsão mostrada nos botões bate com o que acontece ---------------
{
  const carta = responder(responder(CARTA_NOVA, 'bom'), 'bom');
  const p = previsao(carta);
  const real = intervaloEmPalavras(responder(carta, 'facil').intervalo);
  eq('o botão promete o que o algoritmo cumpre', p.facil, real);
  eq('errar promete "amanhã"', p.errei, 'amanhã');
  if (Object.keys(p).length === 4) ok('há previsão para os quatro botões');
  else bad('há previsão para os quatro botões', Object.keys(p).length);
}

eq('1 dia em palavras', intervaloEmPalavras(1), 'amanhã');
eq('45 dias viram meses', intervaloEmPalavras(45), '2 meses');
eq('400 dias viram 1 ano', intervaloEmPalavras(400), '1 ano');
eq('zero dia é agora', intervaloEmPalavras(0), 'agora');

console.log('\nOfensiva\n');

const DIA = 24 * 60 * 60 * 1000;
const HOJE = '2026-07-29';
const base = new Date(`${HOJE}T12:00:00`).getTime();
const atras = (n) => diasAtras(n, base);

// --- A REGRA QUE IMPORTA: hoje ainda não conta contra você ----------------
{
  const semHoje = [atras(1), atras(2), atras(3)];
  const o = calcularOfensiva(semHoje, HOJE);
  eq('estudou ontem e ainda não hoje: a ofensiva continua de pé', o.atual, 3);
  if (o.emRisco) ok('e a tela é avisada de que está por um fio');
  else bad('e a tela é avisada de que está por um fio');

  const comHoje = calcularOfensiva([HOJE, ...semHoje], HOJE);
  eq('estudando hoje, o dia entra na conta', comHoje.atual, 4);
  if (!comHoje.emRisco) ok('e o aviso de risco some');
  else bad('e o aviso de risco some');
}

// --- um dia em branco quebra ---------------------------------------------
{
  const o = calcularOfensiva([HOJE, atras(1), atras(3), atras(4)], HOJE);
  eq('o buraco no meio corta a sequência', o.atual, 2);
  eq('mas o recorde lembra do trecho maior', o.recorde, 2);
}
{
  const o = calcularOfensiva([HOJE, atras(1), atras(3), atras(4), atras(5), atras(6)], HOJE);
  eq('o recorde é a maior sequência de todas', o.recorde, 4);
}

// --- casos de borda -------------------------------------------------------
eq('sem nenhum dia, ofensiva zero', calcularOfensiva([], HOJE).atual, 0);
eq('sem nenhum dia, recorde zero', calcularOfensiva([], HOJE).recorde, 0);
eq('sem nenhum dia, nada em risco', calcularOfensiva([], HOJE).emRisco, false);
eq('a última vez foi há uma semana: quebrou', calcularOfensiva([atras(7)], HOJE).atual, 0);
eq('só hoje: ofensiva de um', calcularOfensiva([HOJE], HOJE).atual, 1);
eq('dia repetido não conta duas vezes', calcularOfensiva([HOJE, HOJE, atras(1)], HOJE).atual, 2);

// --- O FUSO: o defeito que só aparece à noite -----------------------------
{
  // 22h no horário de Brasília é 01h do dia SEGUINTE em UTC. Se o dia fosse
  // gravado com toISOString, quem estuda à noite marcaria o dia errado — e a
  // ofensiva quebraria sozinha para metade do país.
  const noite = new Date(2026, 6, 29, 22, 30, 0);
  eq('estudo às 22h30 conta no dia 29, não no 30', diaDe(noite), '2026-07-29');
  const madrugada = new Date(2026, 6, 29, 0, 15, 0);
  eq('estudo às 00h15 conta no dia 29', diaDe(madrugada), '2026-07-29');
}

eq('o dia tem o formato AAAA-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(diaDe()), true);
eq('mês e dia vêm com zero à esquerda', diaDe(new Date(2026, 0, 5)), '2026-01-05');

// --- o mapa de calor ------------------------------------------------------
{
  const registros = new Map([[atras(0), 10], [atras(3), 4]]);
  const mapa = ultimosDias(registros, 12, base);
  eq('doze semanas dão 84 quadrados', mapa.length, 84);
  eq('o último quadrado é hoje', mapa[mapa.length - 1].dia, HOJE);
  eq('dia sem estudo entra com peso zero', mapa[mapa.length - 2].peso, 0);
  eq('dia com estudo entra com o peso certo', mapa[mapa.length - 1].peso, 10);
  if (mapa.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.dia))) ok('todo quadrado tem um dia válido');
  else bad('todo quadrado tem um dia válido');
}

// --- a escala de tom é relativa ao próprio histórico ----------------------
eq('sem estudo, tom zero', intensidade(0, 80), 0);
eq('quem revisa 80 por dia: 80 é o tom cheio', intensidade(80, 80), 4);
eq('quem revisa 4 por dia: 4 também é o tom cheio', intensidade(4, 4), 4);
eq('um quarto do pico é o tom mais claro', intensidade(1, 20), 1);
eq('pico de um não divide por zero', intensidade(1, 1), 4);
eq('pico zero não divide por zero', intensidade(0, 0), 0);

console.log('\nCartas tiradas da nota\n');

// --- os quatro padrões ----------------------------------------------------
{
  const s = sugerirCartas('Mitocôndria: organela responsável pela respiração celular.');
  eq('definição com dois pontos vira carta', s.length, 1);
  eq('a frente é o termo', s[0].frente, 'Mitocôndria');
  eq('o verso é a definição', s[0].verso, 'organela responsável pela respiração celular');
  eq('e sai marcada como definição', s[0].origem, 'definicao');
}
{
  const s = sugerirCartas('## Fotossíntese\nProcesso em que a planta converte luz em açúcar.');
  eq('título seguido de parágrafo vira carta', s.length, 1);
  eq('a frente é o título, sem os #', s[0].frente, 'Fotossíntese');
  eq('o verso é o parágrafo', s[0].verso, 'Processo em que a planta converte luz em açúcar');
  eq('e sai marcada como título', s[0].origem, 'titulo');
}
{
  const s = sugerirCartas('- **Cloroplasto** é onde a fotossíntese acontece');
  eq('destaque em negrito vira carta', s.length, 1);
  eq('a frente vem sem os asteriscos', s[0].frente, 'Cloroplasto');
  eq('e sai marcada como destaque', s[0].origem, 'destaque');
}
{
  const s = sugerirCartas('- Núcleo — guarda o material genético');
  eq('item de lista com travessão vira carta', s.length, 1);
  eq('e sai marcada como lista', s[0].origem, 'lista');
}

// --- A PENEIRA: sugestão ruim custa caro ----------------------------------
{
  eq('frase comum com dois pontos NÃO vira carta',
    sugerirCartas('Então o professor falou o seguinte: prestem atenção').length, 0);
  eq('frase começando com conectivo NÃO vira carta',
    sugerirCartas('E na aula de ontem: a gente parou na página 40').length, 0);
  eq('frente longa demais NÃO vira carta',
    sugerirCartas(('palavra ').repeat(20) + ': resposta').length, 0);
  eq('verso curto demais NÃO vira carta', sugerirCartas('Termo: ok').length, 0);
  eq('frente igual ao verso NÃO vira carta', sugerirCartas('Mitose: mitose').length, 0);
  eq('linha sem separador NÃO vira carta', sugerirCartas('A aula foi boa hoje').length, 0);
}

// --- bloco de código: os dois pontos ali são sintaxe ----------------------
{
  const nota = [
    'Antes do código.',
    '```js',
    'const objeto = { chave: valor que não é definição nenhuma };',
    'outra: coisa qualquer aqui dentro do bloco',
    '```',
    'Mitocôndria: organela da respiração celular.',
  ].join('\n');
  const s = sugerirCartas(nota);
  eq('o que está dentro do bloco de código é ignorado', s.length, 1);
  eq('e o que está fora continua virando carta', s[0].frente, 'Mitocôndria');
}

// --- duplicata: duas cartas com a mesma frente competem entre si ----------
{
  const s = sugerirCartas('Mitose: divisão celular\nMitose: outra explicação qualquer');
  eq('a mesma frente não vira duas cartas', s.length, 1);
  const caixa = sugerirCartas('Mitose: divisão celular\nMITOSE: outra explicação');
  eq('e a comparação ignora maiúscula', caixa.length, 1);
}

// --- o limite existe para a tela não explodir ----------------------------
{
  const muitas = Array.from({ length: 100 }, (_, i) => `Termo${i}: explicação do termo ${i}`).join('\n');
  eq('o limite é respeitado', sugerirCartas(muitas, 10).length, 10);
  eq('e o padrão não passa de 40', sugerirCartas(muitas).length, 40);
}

// --- markdown some da carta ----------------------------------------------
{
  const s = sugerirCartas('**Glicólise**: quebra da *glicose* em `piruvato`');
  eq('negrito, itálico e código saem do texto', s[0].verso, 'quebra da glicose em piruvato');
}
{
  const s = sugerirCartas('Enzima: proteína que [acelera reações](http://x.com)');
  eq('o link vira só o texto dele', s[0].verso, 'proteína que acelera reações');
}

// --- da aula transcrita: só o conteúdo ------------------------------------
{
  const trechos = [
    { texto: 'Bom dia, senta aí. Fulano: para de conversar agora', tipo: 'ruido' },
    { texto: 'Mitocôndria: organela da respiração celular', tipo: 'conteudo' },
    { texto: 'Prova: dia doze de agosto', tipo: 'tarefa' },
  ];
  const s = sugerirDaAula(trechos);
  eq('só o conteúdo vira carta', s.length, 1);
  eq('e é o conteúdo certo', s[0].frente, 'Mitocôndria');
  if (!s.some((c) => /Fulano|prova|agosto/i.test(c.frente))) ok('ruído e tarefa ficam de fora');
  else bad('ruído ou tarefa viraram carta', JSON.stringify(s));
}

// --- entrada degenerada não derruba nada ---------------------------------
eq('nota vazia não gera carta', sugerirCartas('').length, 0);
eq('só espaço não gera carta', sugerirCartas('   \n\n  ').length, 0);
eq('aula sem trecho nenhum não gera carta', sugerirDaAula([]).length, 0);

console.log(`\n${pass} passaram, ${fail} falharam\n`);
process.exit(fail === 0 ? 0 : 1);
