/**
 * Testes das ligações entre notas (`[[assim]]`), do marca-texto e do
 * reconhecimento de imagem por bytes.
 *
 * O caso que mais importa é a comparação de títulos. Quem escreve numa aula
 * escreve rápido e sem acento; se `[[fotossintese]]` não achasse a nota
 * "Fotossíntese", o recurso falharia justo para quem ele foi feito — e falharia
 * em silêncio, criando uma nota duplicada em vez de dar erro.
 */
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

/**
 * O profile.service importa o cliente do Supabase e o tema, que não existem
 * fora do aplicativo. As funções testadas aqui — reconhecer o formato pelos
 * bytes e dizer se um GIF anima — são puras e não tocam em nenhum dos dois, mas
 * o `import` no topo do arquivo é executado do mesmo jeito.
 *
 * Daí o dublê: qualquer import vira um objeto vazio. Se algum dia uma dessas
 * funções passar a usar de verdade o que está sendo dublado, o teste quebra com
 * "não é uma função" em vez de passar mentindo.
 */
function carregar(arquivo) {
  const src = fs.readFileSync(path.join(__dirname, '..', arquivo), 'utf8');
  const { outputText } = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', outputText)(mod, mod.exports, () => ({}));
  return mod.exports;
}

const { tokenizeInline, ligacoesDe, chaveDeNota } = carregar(
  'src/features/editor/utils/markdown-parser.ts'
);
const { formatoDaImagem, gifEhAnimado, LIMITE_DE_IMAGEM } = carregar(
  'src/features/profile/services/profile.service.ts'
);

let pass = 0;
let fail = 0;
const ok = (n) => { pass++; console.log('  OK   ' + n); };
const bad = (n, d) => { fail++; console.log('  FAIL ' + n + (d !== undefined ? ' -> ' + d : '')); };
const eq = (n, a, b) => (a === b ? ok(n) : bad(n, `esperava ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`));
const eqL = (n, a, b) =>
  JSON.stringify(a) === JSON.stringify(b) ? ok(n) : bad(n, `esperava ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`);

console.log('\nLigações entre notas\n');

/* ------------------------------------------------- reconhecer no texto */
{
  const t = tokenizeInline('veja [[Fotossíntese]] depois');
  eq('a ligação vira um token próprio', t[1].type, 'nota');
  eq('com o título limpo', t[1].text, 'Fotossíntese');
  eq('e o texto em volta sobrevive', t[0].text, 'veja ');
}
{
  const t = tokenizeInline('[[  Ciclo de Krebs  ]]');
  eq('espaço em volta do nome é aparado', t[0].text, 'Ciclo de Krebs');
}
{
  // A armadilha da ordem: `[texto](link)` casaria o `[nota]` de dentro e
  // sobraria um colchete solto na tela.
  const t = tokenizeInline('[[Nota]] e [site](https://a.com)');
  eq('ligação e link normal convivem', t[0].type, 'nota');
  eq('o link continua sendo link', t.find((x) => x.type === 'link').href, 'https://a.com');
}
{
  const t = tokenizeInline('**forte** e [[Nota]] e *fraco*');
  eq('negrito continua negrito', t[0].type, 'bold');
  eq('a ligação no meio', t.find((x) => x.type === 'nota').text, 'Nota');
  eq('e o itálico no fim', t[t.length - 1].type, 'italic');
}
{
  const t = tokenizeInline('use ==isto== para marcar');
  eq('marca-texto vira token', t[1].type, 'mark');
  eq('com o texto de dentro', t[1].text, 'isto');
}
{
  const t = tokenizeInline('`[[isto não conta]]`');
  eq('dentro de crase é código, não ligação', t[0].type, 'code');
}

/* --------------------------------------------------- varrer a nota toda */
eqL('acha as ligações', ligacoesDe('cita [[A]] e depois [[B]]'), ['A', 'B']);
eqL('sem repetir', ligacoesDe('[[A]] e [[A]] de novo'), ['A']);
eqL('nota sem ligação nenhuma', ligacoesDe('só texto comum'), []);
eqL('em linhas diferentes', ligacoesDe('linha um [[A]]\nlinha dois [[B]]'), ['A', 'B']);
eqL('nome vazio não vira ligação', ligacoesDe('[[   ]]'), []);
{
  // Um tutorial de markdown escrito no app criaria menções que ninguém quis.
  const texto = 'antes [[Real]]\n```\nexemplo: [[Falsa]]\n```\ndepois [[Outra]]';
  eqL('bloco de código é pulado', ligacoesDe(texto), ['Real', 'Outra']);
}
{
  // Código que não fecha: o resto da nota fica dentro do bloco. É o
  // comportamento do markdown, e melhor do que "adivinhar" onde fecharia.
  eqL('bloco aberto engole o resto', ligacoesDe('a\n```\n[[Dentro]]'), []);
}

/* ------------------------------------------------- comparar os títulos */
eq('acento não atrapalha', chaveDeNota('Fotossíntese'), chaveDeNota('fotossintese'));
eq('maiúscula também não', chaveDeNota('CICLO DE KREBS'), chaveDeNota('ciclo de krebs'));
eq('espaço duplo é o mesmo que simples', chaveDeNota('a  b'), chaveDeNota('a b'));
eq('espaço nas pontas some', chaveDeNota('  Nota  '), 'nota');
eq('cedilha', chaveDeNota('Função'), chaveDeNota('funcao'));
eq('til', chaveDeNota('Revisão'), chaveDeNota('revisao'));
// E o que NÃO pode virar igual: dois assuntos diferentes têm de continuar
// diferentes, ou a ligação abriria a nota errada.
eq('nomes diferentes continuam diferentes', chaveDeNota('Biologia') === chaveDeNota('Bioquímica'), false);
eq('título vazio dá chave vazia', chaveDeNota('   '), '');

/* =================================== a imagem, reconhecida pelos bytes */
console.log('');
const comCabecalho = (bytes) => {
  const a = new Uint8Array(16);
  a.set(bytes);
  return a;
};

eq('GIF87a', formatoDaImagem(comCabecalho([0x47, 0x49, 0x46, 0x38, 0x37, 0x61])).mime, 'image/gif');
eq('GIF89a', formatoDaImagem(comCabecalho([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])).mime, 'image/gif');
eq('PNG', formatoDaImagem(comCabecalho([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])).mime, 'image/png');
eq('JPEG', formatoDaImagem(comCabecalho([0xff, 0xd8, 0xff, 0xe0])).mime, 'image/jpeg');
{
  const webp = comCabecalho([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  eq('WEBP', formatoDaImagem(webp).mime, 'image/webp');
}
eq('a extensão sai certa junto', formatoDaImagem(comCabecalho([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])).extensao, 'gif');

// O caso de existir: um arquivo chamado .gif que é outra coisa. Enviar com o
// Content-Type errado faz a foto simplesmente não aparecer para ninguém.
eq('arquivo que não é imagem é recusado', formatoDaImagem(comCabecalho([0x50, 0x4b, 0x03, 0x04])), null);
eq('texto puro é recusado', formatoDaImagem(comCabecalho([0x68, 0x65, 0x6c, 0x6c, 0x6f])), null);
eq('arquivo curto demais não estoura', formatoDaImagem(new Uint8Array([0x47, 0x49])), null);
eq('arquivo vazio', formatoDaImagem(new Uint8Array(0)), null);
{
  // RIFF sem WEBP: é um WAV, não uma imagem.
  const wav = comCabecalho([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);
  eq('RIFF que não é WEBP é recusado', formatoDaImagem(wav), null);
}

{
  // Um GIF de quadro único fica parado igual a um JPEG. Quem assinou o Pro para
  // ter foto animada precisa ser avisado antes de achar que o recurso quebrou.
  const cabecalho = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0, 0, 0, 0];
  const umQuadro = new Uint8Array([...cabecalho, 0x00, 0x2c, 0, 0, 0, 0]);
  const dois = new Uint8Array([...cabecalho, 0x00, 0x2c, 0, 0, 0x00, 0x2c, 0, 0]);
  eq('GIF de um quadro só não é animado', gifEhAnimado(umQuadro), false);
  eq('GIF com dois quadros é animado', gifEhAnimado(dois), true);
  eq('sem quadro nenhum não é animado', gifEhAnimado(new Uint8Array(cabecalho)), false);
}

eq('o limite bate com o do bucket', LIMITE_DE_IMAGEM, 8 * 1024 * 1024);

console.log(`\n${pass} passaram, ${fail} falharam\n`);
process.exit(fail === 0 ? 0 : 1);
