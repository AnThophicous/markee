/**
 * Testes da cor de cargo.
 *
 * O que se está garantindo aqui é uma coisa só: nenhum nome fica ilegível,
 * qualquer que seja a cor que a pessoa escolheu e qualquer que seja o tema.
 * É o tipo de defeito que não dá erro nenhum — o nome simplesmente some no
 * fundo, e só quem usa o tema claro percebe.
 */
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../src/features/groups/role-color.ts'), 'utf8');
const { outputText } = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const mod = { exports: {} };
new Function('module', 'exports', outputText)(mod, mod.exports);
const { corDeCargo, contraste, lerHex } = mod.exports;

let pass = 0;
let fail = 0;
const ok = (n) => { pass++; console.log('  OK   ' + n); };
const bad = (n, d) => { fail++; console.log('  FAIL ' + n + (d !== undefined ? ' -> ' + d : '')); };

// Os fundos de referência de verdade, iguais aos do useGroupIdentity: no tema
// escuro não é o preto do fundo da tela e sim o `subtle`, um cinza um pouco
// acima dele — é o fundo das etiquetas de cargo, onde a cor tem menos folga.
const FUNDO_CLARO = '#FFFFFF';
const FUNDO_ESCURO = '#1A1A1C';
const TINTA_CLARA = '#0A0A0A';
const TINTA_ESCURA = '#FAFAFA';

console.log('\nCor de cargo\n');

/* ------------------------------------------------------------- leitura do hex */
{
  if (lerHex('#FF0000')) ok('lê hex de seis dígitos');
  else bad('hex de seis dígitos');

  const curto = lerHex('#f00');
  if (curto && Math.abs(curto.r - 1) < 0.001 && curto.g === 0) ok('lê hex de três dígitos');
  else bad('hex de três dígitos', JSON.stringify(curto));

  if (lerHex('FF0000')) ok('aceita hex sem o #');
  else bad('hex sem #');

  if (lerHex('vermelho') === null) ok('recusa texto que não é cor');
  else bad('texto virou cor');

  if (lerHex(null) === null && lerHex(undefined) === null && lerHex('') === null) {
    ok('nulo, indefinido e vazio não viram cor');
  } else bad('nulo/vazio viraram cor');

  if (lerHex('#12345') === null) ok('recusa hex com quantidade errada de dígitos');
  else bad('hex de 5 dígitos passou');
}

/* ----------------------------------------------------------------- contraste */
{
  // Preto e branco literais: aqui se confere a fórmula, não o tema.
  const extremo = contraste('#000000', '#FFFFFF');
  if (Math.abs(extremo - 21) < 0.1) ok('preto sobre branco dá 21');
  else bad('contraste preto/branco', extremo);

  if (Math.abs(contraste(FUNDO_CLARO, FUNDO_CLARO) - 1) < 0.001) ok('cor igual a si mesma dá 1');
  else bad('contraste de cor consigo mesma', contraste(FUNDO_CLARO, FUNDO_CLARO));

  // A ordem não pode importar: a fórmula divide o mais claro pelo mais escuro.
  if (Math.abs(contraste('#3987e5', FUNDO_CLARO) - contraste(FUNDO_CLARO, '#3987e5')) < 0.001) {
    ok('o contraste não depende da ordem dos argumentos');
  } else bad('contraste mudou com a ordem');
}

/* -------------------------------- toda cor fica legível nos dois temas */
{
  // Inclui os casos difíceis de propósito: amarelo puro é quase invisível no
  // branco, e azul-marinho quase invisível no preto.
  const cores = [
    ['vermelho', '#FF0000'],
    ['amarelo', '#FFFF00'],
    ['verde-limão', '#00FF00'],
    ['ciano', '#00FFFF'],
    ['azul', '#0000FF'],
    ['magenta', '#FF00FF'],
    ['branco', '#FFFFFF'],
    ['preto', '#000000'],
    ['azul-marinho', '#000080'],
    ['bege', '#F5F5DC'],
    ['cinza médio', '#808080'],
    ['roxo do Discord', '#5865F2'],
    ['verde do Discord', '#57F287'],
    ['amarelo do Discord', '#FEE75C'],
    ['rosa da marca', '#F62283'],
  ];

  let ruinsClaro = [];
  let ruinsEscuro = [];

  for (const [nome, cor] of cores) {
    const noClaro = corDeCargo(cor, FUNDO_CLARO, TINTA_CLARA);
    const noEscuro = corDeCargo(cor, FUNDO_ESCURO, TINTA_ESCURA);
    if (contraste(noClaro, FUNDO_CLARO) < 4.5) ruinsClaro.push(`${nome} (${cor}→${noClaro})`);
    if (contraste(noEscuro, FUNDO_ESCURO) < 4.5) ruinsEscuro.push(`${nome} (${cor}→${noEscuro})`);
  }

  if (ruinsClaro.length === 0) ok('todas as cores ficam legíveis no tema claro');
  else bad('ilegíveis no claro', ruinsClaro.join(', '));

  if (ruinsEscuro.length === 0) ok('todas as cores ficam legíveis no tema escuro');
  else bad('ilegíveis no escuro', ruinsEscuro.join(', '));
}

/* ------------------------------------------- cor que já serve não é mexida */
{
  // #B00020 já contrasta bem com branco; mexer nele seria desrespeitar a escolha.
  const antes = '#B00020';
  const depois = corDeCargo(antes, FUNDO_CLARO, TINTA_CLARA);
  if (depois.toLowerCase() === antes.toLowerCase()) ok('cor que já contrasta sai intacta');
  else bad('cor boa foi alterada', `${antes} -> ${depois}`);
}

/* ------------------------------------------------------------ o tom se mantém */
{
  // Vermelho tem de continuar vermelho: o canal R precisa seguir sendo o maior.
  const claro = corDeCargo('#FF0000', FUNDO_CLARO, TINTA_CLARA);
  const rgb = lerHex(claro);
  if (rgb && rgb.r > rgb.g && rgb.r > rgb.b) ok('vermelho continua vermelho depois do ajuste');
  else bad('o vermelho mudou de tom', claro);

  // Azul no tema escuro clareia, mas segue azul.
  const escuro = corDeCargo('#000080', FUNDO_ESCURO, TINTA_ESCURA);
  const rgbE = lerHex(escuro);
  if (rgbE && rgbE.b > rgbE.r && rgbE.b > rgbE.g) ok('azul continua azul depois do ajuste');
  else bad('o azul mudou de tom', escuro);
}

/* -------------------------------------------------------- direção do ajuste */
{
  // No claro tem de escurecer; no escuro, clarear. O contrário passaria no
  // teste de contraste em alguns casos e ainda assim estaria errado.
  const amareloClaro = lerHex(corDeCargo('#FFFF00', FUNDO_CLARO, TINTA_CLARA));
  const amareloOriginal = lerHex('#FFFF00');
  if (amareloClaro.r < amareloOriginal.r) ok('sobre fundo claro a cor escurece');
  else bad('a cor clareou sobre fundo claro');

  const marinhoEscuro = lerHex(corDeCargo('#000080', FUNDO_ESCURO, TINTA_ESCURA));
  const marinhoOriginal = lerHex('#000080');
  if (marinhoEscuro.b > marinhoOriginal.b) ok('sobre fundo escuro a cor clareia');
  else bad('a cor escureceu sobre fundo escuro');
}

/* ------------------------------------------------------ sem cargo, sem cor */
{
  if (corDeCargo(null, FUNDO_CLARO, TINTA_CLARA) === TINTA_CLARA) ok('membro sem cargo usa a cor normal do texto');
  else bad('sem cargo', corDeCargo(null, FUNDO_CLARO, TINTA_CLARA));

  if (corDeCargo('lixo', FUNDO_CLARO, TINTA_CLARA) === TINTA_CLARA) ok('cor inválida cai na cor normal do texto');
  else bad('cor inválida', corDeCargo('lixo', FUNDO_CLARO, TINTA_CLARA));

  if (corDeCargo(undefined, FUNDO_ESCURO, TINTA_ESCURA) === TINTA_ESCURA) ok('indefinido cai na cor normal do texto');
  else bad('indefinido', corDeCargo(undefined, FUNDO_ESCURO, TINTA_ESCURA));
}

/* ------------------------------------- o pior caso não devolve coisa quebrada */
{
  // Branco sobre branco não chega a 4.5 sem virar preto. O que não pode é sair
  // NaN, string vazia ou 'undefined' — isso o React Native aceita e desenha
  // preto sem avisar, e o defeito viraria "às vezes o nome fica preto".
  const impossivel = corDeCargo('#FFFFFF', FUNDO_CLARO, TINTA_CLARA);
  if (/^#[0-9a-f]{6}$/i.test(impossivel)) ok('o pior caso ainda devolve um hex válido');
  else bad('o pior caso devolveu lixo', JSON.stringify(impossivel));

  if (contraste(impossivel, FUNDO_CLARO) > contraste('#FFFFFF', FUNDO_CLARO)) {
    ok('o pior caso melhora o contraste mesmo sem bater a meta');
  } else bad('o pior caso não melhorou nada');
}

/* -------------------------------------------------- estabilidade do resultado */
{
  // Chamar duas vezes tem de dar o mesmo valor: a lista de membros redesenha a
  // cada mensagem, e uma cor que oscila apareceria como piscada.
  const a = corDeCargo('#FFFF00', FUNDO_CLARO, TINTA_CLARA);
  const b = corDeCargo('#FFFF00', FUNDO_CLARO, TINTA_CLARA);
  if (a === b) ok('a mesma entrada dá sempre a mesma cor');
  else bad('resultado instável', `${a} != ${b}`);

  // E aplicar de novo sobre o resultado não muda mais nada.
  const c = corDeCargo(a, FUNDO_CLARO, TINTA_CLARA);
  if (c === a) ok('ajustar uma cor já ajustada não muda nada');
  else bad('o ajuste não é estável', `${a} -> ${c}`);
}

console.log(`\n${pass} passaram, ${fail} falharam\n`);
process.exit(fail > 0 ? 1 : 0);
