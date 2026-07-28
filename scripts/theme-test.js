/**
 * Testes da paleta e do sistema de movimento.
 *
 * A paleta é a única parte do redesenho que dá para provar. "Ficou bonito" é
 * opinião; "este texto tem 2,9:1 de contraste e some para quem enxerga pouco" é
 * fato — e é o tipo de defeito que ninguém reporta, porque quem não consegue
 * ler simplesmente desinstala.
 *
 * Cada PAR usado na interface é conferido, e não cada cor isolada: cor não tem
 * contraste sozinha, só contra o fundo em que cai.
 */
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

/**
 * O `require` é dublado porque o Reanimated só existe dentro do app. O dublê do
 * `Easing` devolve a própria descrição da curva em vez de uma função de
 * animação: aqui não se anima nada, só se confere que a curva foi declarada.
 */
const DUBLE = {
  'react-native-reanimated': {
    Easing: {
      bezier: (...pontos) => ({ tipo: 'bezier', pontos }),
      out: (f) => ({ tipo: 'out', de: f }),
      quad: { tipo: 'quad' },
    },
  },
};

function carregar(arquivo) {
  const src = fs.readFileSync(path.join(__dirname, arquivo), 'utf8');
  const { outputText } = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', outputText)(
    mod,
    mod.exports,
    (nome) => DUBLE[nome] ?? {}
  );
  return mod.exports;
}

const { themes, radii, GOOGLE, elevacao } = carregar('../src/theme/tokens.ts');
const { contraste } = carregar('../src/features/groups/role-color.ts');

let pass = 0;
let fail = 0;
const ok = (n) => { pass++; console.log('  OK   ' + n); };
const bad = (n, d) => { fail++; console.log('  FAIL ' + n + (d !== undefined ? ' -> ' + d : '')); };

console.log('\nPaleta e movimento\n');

/* ------------------------------------------------------- contraste de texto */
{
  // Cada par é um lugar de verdade na interface. Texto normal precisa de 4.5:1
  // pela WCAG; abaixo disso some para quem enxerga pouco, e fica cansativo
  // para todo mundo numa tela ao sol.
  const pares = [
    ['texto sobre o fundo', 'onSurface', 'surface'],
    ['texto sobre cartão baixo', 'onSurface', 'surfaceLow'],
    ['texto sobre cartão médio', 'onSurface', 'surfaceMid'],
    ['texto sobre cartão alto', 'onSurface', 'surfaceHigh'],
    ['texto secundário sobre o fundo', 'onSurfaceVariant', 'surface'],
    ['texto secundário sobre cartão médio', 'onSurfaceVariant', 'surfaceMid'],
    ['texto sobre o botão principal', 'onPrimary', 'primary'],
    ['texto dentro do container da ação', 'onPrimaryContainer', 'primaryContainer'],
    ['texto sobre o erro', 'onError', 'error'],
    ['texto dentro do container de erro', 'onErrorContainer', 'errorContainer'],
  ];

  for (const modo of ['light', 'dark']) {
    const t = themes[modo];
    const ruins = [];
    for (const [nome, frente, fundo] of pares) {
      const c = contraste(t[frente], t[fundo]);
      if (c < 4.5) ruins.push(`${nome} (${c.toFixed(2)}:1)`);
    }
    if (ruins.length === 0) ok(`tema ${modo}: todo texto passa em 4.5:1`);
    else bad(`tema ${modo}: texto ilegível`, ruins.join('; '));
  }
}

/* ------------------------------------------- a cor de ação precisa se ver */
{
  // O azul da ação sobre o fundo não é texto corrido, mas é o que a pessoa
  // procura para saber onde tocar. 3:1 é o mínimo da WCAG para elemento de
  // interface, e é o que se cobra aqui.
  for (const modo of ['light', 'dark']) {
    const t = themes[modo];
    const c = contraste(t.primary, t.surface);
    if (c >= 3) ok(`tema ${modo}: a cor de ação se destaca do fundo (${c.toFixed(2)}:1)`);
    else bad(`tema ${modo}: a cor de ação some no fundo`, c.toFixed(2));
  }
}

/* ------------------------------------------------- as superfícies se separam */
{
  // Se dois níveis de superfície forem quase iguais, o empilhamento de cartão
  // do Material 3 desaparece e tudo vira um bloco só — que é exatamente o
  // problema que o preto absoluto do tema antigo causava.
  for (const modo of ['light', 'dark']) {
    const t = themes[modo];
    const niveis = ['surface', 'surfaceLow', 'surfaceMid', 'surfaceHigh'];
    let colados = [];
    for (let i = 0; i < niveis.length - 1; i++) {
      const c = contraste(t[niveis[i]], t[niveis[i + 1]]);
      if (c < 1.02) colados.push(`${niveis[i]}/${niveis[i + 1]}`);
    }
    if (colados.length === 0) ok(`tema ${modo}: os quatro níveis de superfície se distinguem`);
    else bad(`tema ${modo}: superfícies coladas`, colados.join(', '));
  }

  // E não podem se separar demais: quatro níveis muito distantes fazem o cartão
  // parecer um recorte colado sobre a tela em vez de uma elevação.
  for (const modo of ['light', 'dark']) {
    const t = themes[modo];
    const c = contraste(t.surface, t.surfaceHigh);
    if (c <= 1.6) ok(`tema ${modo}: a elevação é sutil, não um recorte (${c.toFixed(2)}:1)`);
    else bad(`tema ${modo}: superfícies distantes demais`, c.toFixed(2));
  }
}

/* ------------------------------------------------------ as cores da marca */
{
  const nomes = Object.keys(GOOGLE);
  if (nomes.length === 4) ok('as quatro cores da marca do Google estão definidas');
  else bad('cores da marca', nomes.join(','));

  const validas = Object.values(GOOGLE).every((c) => /^#[0-9A-Fa-f]{6}$/.test(c));
  if (validas) ok('as cores da marca são hexadecimal de 6 dígitos');
  else bad('formato das cores da marca', JSON.stringify(GOOGLE));

  // O azul da marca (#4285F4) NÃO serve como cor de texto sobre branco — dá
  // 3,1:1. É por isso que a primária do tema é um azul mais escuro. Se alguém
  // "corrigir" isso um dia trocando pelo azul da marca, este teste avisa.
  const cMarca = contraste(GOOGLE.azul, themes.light.surface);
  const cPrim = contraste(themes.light.primary, themes.light.surface);
  if (cPrim > cMarca) ok('a primária do tema claro contrasta mais que o azul da marca');
  else bad('a primária ficou mais fraca que o azul cru da marca', `${cPrim.toFixed(2)} vs ${cMarca.toFixed(2)}`);
}

/* ------------------------------------------------------------ a escala de canto */
{
  const esperada = ['none', 'xs', 'sm', 'md', 'lg', 'xl', 'full'];
  const faltando = esperada.filter((k) => radii[k] === undefined);
  if (faltando.length === 0) ok('a escala de canto do Material 3 está completa');
  else bad('faltam degraus na escala', faltando.join(','));

  // Tem de ser crescente até o xl: uma escala fora de ordem faz o componente
  // grande receber canto menor que o pequeno sem ninguém notar na revisão.
  const ate = ['none', 'xs', 'sm', 'md', 'lg', 'xl'].map((k) => radii[k]);
  const crescente = ate.every((v, i) => i === 0 || v > ate[i - 1]);
  if (crescente) ok('a escala de canto é crescente');
  else bad('escala fora de ordem', ate.join(' < '));

  if (radii.xl === 28) ok('o canto grande é 28, o do Material 3');
  else bad('canto grande fora do padrão', radii.xl);
}

/* ------------------------------------------------------------- a elevação */
{
  // Sombra no tema escuro não aparece: o fundo já é escuro. Lá a elevação é
  // feita subindo de superfície, e devolver sombra seria desenho morto.
  const escuro = elevacao(2, 'dark');
  if (Object.keys(escuro).length === 0) ok('o tema escuro não usa sombra');
  else bad('o tema escuro devolveu sombra', JSON.stringify(escuro));

  const claro = elevacao(2, 'light');
  if (claro.shadowRadius > 0 && claro.elevation > 0) ok('o tema claro usa sombra');
  else bad('o tema claro ficou sem sombra', JSON.stringify(claro));

  if (Object.keys(elevacao(0, 'light')).length === 0) ok('nível 0 não desenha sombra nenhuma');
  else bad('nível 0 devolveu sombra');

  // Níveis maiores têm de ser mais fortes, senão a hierarquia é decorativa.
  const a = elevacao(1, 'light');
  const b = elevacao(3, 'light');
  if (b.shadowRadius > a.shadowRadius && b.elevation > a.elevation) {
    ok('níveis maiores de elevação têm sombra mais forte');
  } else bad('a elevação não cresce com o nível');
}

/* ------------------------------------------------------------- o movimento */
{
  const motion = carregar('../src/theme/motion.ts');
  const fn = motion.atrasoEmCascata;
  const src = fs.readFileSync(path.join(__dirname, '../src/theme/motion.ts'), 'utf8');

  // As cinco curvas precisam existir de fato, e não só estar no comentário.
  const curvas = Object.keys(motion.curva ?? {});
  if (curvas.length >= 5) ok('as curvas do Material 3 estão declaradas: ' + curvas.join(', '));
  else bad('faltam curvas', curvas.join(','));

  // Entrada e saída não podem ser a mesma: usar a mesma nos dois faz a saída
  // parecer travada, que é o erro mais comum de quem começa.
  if (JSON.stringify(motion.curva.entrada) !== JSON.stringify(motion.curva.saida)) {
    ok('entrar e sair usam curvas diferentes');
  } else bad('entrada e saída usam a mesma curva');

  // Duração fora da faixa útil: abaixo de 100ms vira piscada, acima de 500ms
  // vira espera.
  const dur = Object.entries(motion.duracao ?? {});
  const foraDaFaixa = dur.filter(([, v]) => v < 80 || v > 500);
  if (dur.length > 0 && foraDaFaixa.length === 0) ok('todas as durações ficam entre 80ms e 500ms');
  else bad('durações fora da faixa útil', JSON.stringify(foraDaFaixa));

  // E precisam estar em ordem: coisa maior demora mais.
  const valores = dur.map(([, v]) => v);
  if (valores.every((v, i) => i === 0 || v > valores[i - 1])) ok('as durações estão em ordem crescente');
  else bad('durações fora de ordem', valores.join(' < '));

  if (fn(0) === 0) ok('o primeiro item da lista entra sem atraso');
  else bad('o primeiro item atrasou', fn(0));

  if (fn(3) > fn(1)) ok('o atraso cresce com a posição na lista');
  else bad('a cascata não cresce', `${fn(1)} -> ${fn(3)}`);

  // Sem teto, uma lista de duzentos itens teria seis segundos de cascata.
  if (fn(200) === fn(8)) ok('a cascata para de crescer depois do oitavo item');
  else bad('a cascata cresce sem limite', `item 200 = ${fn(200)}ms`);

  if (fn(200) <= 300) ok('o último item da cascata entra em no máximo 300ms');
  else bad('cascata longa demais', fn(200));

  if (fn(-5) === 0 && fn(NaN) === 0) ok('posição inválida não vira atraso negativo');
  else bad('posição inválida', `${fn(-5)}, ${fn(NaN)}`);

  const escala = motion.ESCALA_AO_TOCAR;
  if (escala >= 0.94 && escala < 1) ok('a escala de toque é perceptível sem ser exagerada');
  else bad('escala de toque fora do razoável', escala);

  // Molas subamortecidas oscilam, e interface que treme parece quebrada.
  const molas = [...src.matchAll(/damping: (\d+), stiffness: (\d+)/g)];
  const oscilantes = molas.filter(([, d, k]) => Number(d) < 2 * Math.sqrt(Number(k)) * 0.8);
  if (molas.length > 0 && oscilantes.length === 0) ok('nenhuma mola do tema oscila');
  else if (molas.length === 0) bad('não achei nenhuma mola para conferir');
  else bad('molas que oscilam', oscilantes.map((m) => m[0]).join('; '));
}

console.log(`\n${pass} passaram, ${fail} falharam\n`);
process.exit(fail > 0 ? 1 : 0);
