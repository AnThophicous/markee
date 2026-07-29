/**
 * Testes das ferramentas com que a IA MEXE na nota.
 *
 * O que está sendo testado não é o caminho feliz — é o argumento vindo torto.
 * O modelo devolve título entre aspas, data no ano errado, tag com espaço,
 * "reorganização" que na verdade resumiu e jogou metade fora. Cada um desses
 * já é um caderno estragado se passar pela peneira, e nenhum deles derruba
 * nada: o app aceita, grava, e a pessoa descobre depois.
 *
 * Os dois testes que mais importam:
 *   1. reorganizar com texto encurtado — é o único caminho capaz de APAGAR
 *      conteúdo, e o modelo resume sem avisar com frequência.
 *   2. lembrete no passado — nunca dispara, e fica gravado dando a impressão
 *      de estar armado. É a pior falha possível para um app de estudo: a
 *      pessoa confia no lembrete e perde a prova.
 */
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(
  path.join(__dirname, '../src/features/ai/tools/notas-escrita.ts'),
  'utf8'
);
const { outputText } = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const mod = { exports: {} };
new Function('module', 'exports', outputText)(mod, mod.exports);
const {
  proporTitulo,
  proporTags,
  proporSecao,
  proporLembrete,
  proporCartas,
  proporReorganizacao,
  descrever,
  aplicarNoConteudo,
} = mod.exports;

let pass = 0;
let fail = 0;
const ok = (n) => { pass++; console.log('  OK   ' + n); };
const bad = (n, d) => { fail++; console.log('  FAIL ' + n + (d !== undefined ? ' -> ' + d : '')); };
const eq = (n, a, b) => (a === b ? ok(n) : bad(n, `esperava ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`));
const nulo = (n, v) => (v === null ? ok(n) : bad(n, JSON.stringify(v)));

const AGORA = new Date(2026, 6, 29, 10, 0, 0).getTime(); // 29/07/2026, 10h
const ctx = (extra = {}) => ({
  titulo: 'Aula de biologia',
  conteudo: 'A mitocôndria é a organela responsável pela respiração celular da célula.',
  agora: AGORA,
  ...extra,
});

console.log('\nTítulo\n');

eq('título simples', proporTitulo('Respiração celular').titulo, 'Respiração celular');
// O modelo devolve os três com frequência absurda.
eq('tira as aspas', proporTitulo('"Respiração celular"').titulo, 'Respiração celular');
eq('tira as aspas curvas', proporTitulo('“Respiração celular”').titulo, 'Respiração celular');
eq('tira o prefixo "Título:"', proporTitulo('Título: Respiração celular').titulo, 'Respiração celular');
eq('tira o ponto final', proporTitulo('Respiração celular.').titulo, 'Respiração celular');
eq('junta espaços repetidos', proporTitulo('Respiração   celular').titulo, 'Respiração celular');
nulo('título vazio é recusado', proporTitulo(''));
nulo('título de uma letra é recusado', proporTitulo('a'));
nulo('título de 200 caracteres é recusado', proporTitulo('x'.repeat(200)));
nulo('só aspas é recusado', proporTitulo('""'));

console.log('\nTags\n');

{
  const m = proporTags('biologia, prova, celula', ctx());
  eq('três tags', m.tags.length, 3);
  eq('em minúscula', m.tags[0], 'biologia');
}
eq('tira o # que o modelo já pôs', proporTags('#biologia', ctx()).tags[0], 'biologia');
// Tag com espaço não existe: o extrator do app para no primeiro branco, e
// "#prova de biologia" viraria a tag "prova" seguida de texto solto na nota.
eq('espaço vira hífen', proporTags('prova de biologia', ctx()).tags[0], 'prova-de-biologia');
eq('acento é preservado', proporTags('revisão', ctx()).tags[0], 'revisão');
eq('pontuação some', proporTags('bio!!!', ctx()).tags[0], 'bio');
{
  // A repetida: sem isto a nota acumula "#biologia #biologia #biologia" a cada
  // vez que a pessoa pede para etiquetar.
  const m = proporTags('biologia, celula', ctx({ conteudo: 'texto #biologia aqui' }));
  eq('tag que já está na nota é ignorada', m.tags.length, 1);
  eq('e a nova continua', m.tags[0], 'celula');
}
nulo('só tags repetidas não vira proposta', proporTags('biologia', ctx({ conteudo: '#biologia' })));
nulo('nenhuma tag válida não vira proposta', proporTags('!!!, ???', ctx()));
nulo('tag de uma letra é recusada', proporTags('a', ctx()));
eq('no máximo oito tags', proporTags('a1,b2,c3,d4,e5,f6,g7,h8,i9,j10', ctx()).tags.length, 8);
eq('duplicata no mesmo pedido conta uma vez', proporTags('bio, bio, bio', ctx()).tags.length, 1);

console.log('\nSeção\n');

{
  const m = proporSecao('Resumo | A célula tem três partes.');
  eq('título da seção', m.titulo, 'Resumo');
  eq('corpo da seção', m.corpo, 'A célula tem três partes.');
}
eq('o # que o modelo pôs no título some', proporSecao('## Resumo | corpo aqui').titulo, 'Resumo');
eq('barra dentro do corpo é preservada', proporSecao('Resumo | a | b').corpo, 'a | b');
nulo('sem barra separadora, recusa', proporSecao('Resumo sem corpo nenhum'));
nulo('sem corpo, recusa', proporSecao('Resumo |'));
nulo('sem título, recusa', proporSecao('| só corpo'));

console.log('\nLembrete\n');

{
  const m = proporLembrete('2026-08-12 19:00 | Prova de biologia', ctx());
  const d = new Date(m.quando);
  eq('data ISO: dia', d.getDate(), 12);
  eq('data ISO: mês', d.getMonth(), 7);
  eq('data ISO: hora', d.getHours(), 19);
  eq('o texto vem depois da barra', m.texto, 'Prova de biologia');
}
eq('ISO sem hora cai às 9h', new Date(proporLembrete('2026-08-12', ctx()).quando).getHours(), 9);
eq('sem texto, usa o título da nota', proporLembrete('2026-08-12', ctx()).texto, 'Aula de biologia');

{
  const d = new Date(proporLembrete('12/08 às 14:30', ctx()).quando);
  eq('formato brasileiro: dia', d.getDate(), 12);
  eq('formato brasileiro: mês', d.getMonth(), 7);
  eq('formato brasileiro: hora', d.getHours(), 14);
}
{
  const d = new Date(proporLembrete('amanhã 8:00', ctx()).quando);
  eq('"amanhã" é o dia seguinte', d.getDate(), 30);
  eq('e respeita a hora pedida', d.getHours(), 8);
}
{
  // 29/07/2026 é uma quarta. "sexta" tem de ser a desta semana, dia 31.
  const d = new Date(proporLembrete('sexta 15:00', ctx()).quando);
  eq('dia da semana vai para a próxima ocorrência', d.getDate(), 31);
}
{
  // Quarta pedindo "quarta" significa a semana que vem, não daqui a zero dias.
  const d = new Date(proporLembrete('quarta 15:00', ctx()).quando);
  eq('o mesmo dia da semana pula para a semana seguinte', d.getDate(), 5);
}
{
  const d = new Date(proporLembrete('em 10 dias', ctx()).quando);
  eq('"em N dias" conta a partir de hoje', d.getDate(), 8);
}
{
  // "depois de amanhã" contém "amanhã" dentro. Testar na ordem errada marca o
  // lembrete um dia cedo demais.
  const d = new Date(proporLembrete('depois de amanhã 9:00', ctx()).quando);
  eq('"depois de amanhã" são dois dias, não um', d.getDate(), 31);
}
{
  // Palavra dentro de outra não pode valer: "amanhecer" não é "amanhã".
  nulo('"amanhecer" não vira lembrete de amanhã', proporLembrete('amanhecer cedo | x', ctx()));
}

// O DEFEITO QUE PERDE UMA PROVA: lembrete no passado nunca dispara, e fica
// gravado dando a impressão de estar armado.
nulo('data do ano passado é recusada', proporLembrete('2025-08-12 | Prova', ctx()));
nulo('hoje mais cedo é recusado', proporLembrete('2026-07-29 08:00 | Prova', ctx()));
nulo('"hoje" numa hora que já passou é recusado', proporLembrete('hoje 8:00 | Prova', ctx()));
ok('(as três acima são o mesmo defeito: lembrete que nunca toca)');
{
  const m = proporLembrete('hoje 18:00 | Prova', ctx());
  if (m && m.quando > AGORA) ok('"hoje" mais tarde é aceito');
  else bad('hoje mais tarde recusado', JSON.stringify(m));
}

nulo('data absurda no futuro é recusada', proporLembrete('2099-01-01 | Prova', ctx()));
nulo('31 de fevereiro é recusado', proporLembrete('2026-02-31 | Prova', ctx()));
nulo('mês 13 é recusado', proporLembrete('2026-13-01 | Prova', ctx()));
nulo('hora 99 é recusada', proporLembrete('2026-08-12 99:00 | Prova', ctx()));
nulo('texto sem data nenhuma é recusado', proporLembrete('qualquer dia desses | Prova', ctx()));
nulo('argumento vazio é recusado', proporLembrete('', ctx()));

{
  // A ORDEM DAS TENTATIVAS: a data explícita tem de ganhar da palavra solta.
  // Se "amanhã" fosse lido antes, o 12/08 seria ignorado.
  const d = new Date(proporLembrete('amanhã, ou melhor 2026-08-12 | Prova', ctx()).quando);
  eq('data explícita ganha da palavra solta', d.getDate(), 12);
}

console.log('\nCartas\n');

{
  const m = proporCartas('Mitocôndria | organela da respiração\nCloroplasto | onde ocorre fotossíntese');
  eq('duas cartas', m.pares.length, 2);
  eq('a frente', m.pares[0].frente, 'Mitocôndria');
  eq('o verso', m.pares[0].verso, 'organela da respiração');
}
eq('marcador de lista some da frente', proporCartas('- Mitose | divisão celular').pares[0].frente, 'Mitose');
eq('numeração some da frente', proporCartas('1. Mitose | divisão celular').pares[0].frente, 'Mitose');
eq('linha sem barra é descartada', proporCartas('sem barra\nMitose | divisão').pares.length, 1);
eq('no máximo vinte cartas', proporCartas(Array.from({ length: 40 }, (_, i) => `T${i} | R${i}`).join('\n')).pares.length, 20);
nulo('nenhuma linha válida não vira proposta', proporCartas('só texto solto'));
nulo('argumento vazio não vira proposta', proporCartas(''));

console.log('\nReorganizar\n');

{
  const conteudo = ctx().conteudo;
  const maior = '## Introdução\n\n' + conteudo + '\n\n## Detalhes\n\nMais explicação aqui.';
  const m = proporReorganizacao(maior, ctx());
  eq('texto maior e estruturado é aceito', m.tipo, 'reorganizar');
}

// O DEFEITO QUE APAGA A AULA: o modelo resume sem avisar, e "reorganizar" é o
// único caminho que substitui a nota inteira. Aplicar um resumo aqui é perder
// metade do que foi escrito, com um toque e sem desfazer.
nulo(
  'resposta com menos da metade do texto é recusada (o modelo resumiu)',
  proporReorganizacao('## Resumo\n\nA célula respira.', ctx())
);
nulo('texto minúsculo é recusado', proporReorganizacao('ok', ctx()));
nulo('texto idêntico ao atual não vira proposta', proporReorganizacao(ctx().conteudo, ctx()));
{
  // Nota vazia: não há de onde tirar a proporção, então o corte de 50% não se
  // aplica e qualquer texto razoável serve.
  const m = proporReorganizacao('## Começo\n\nUm texto novo qualquer aqui.', ctx({ conteudo: '' }));
  if (m) ok('nota vazia aceita a estrutura proposta');
  else bad('nota vazia recusou');
}

console.log('\nDescrever e aplicar\n');

eq('descreve o título', descrever({ tipo: 'titulo', titulo: 'Bio' }), 'Renomear para "Bio"');
eq('descreve as tags', descrever({ tipo: 'tags', tags: ['a', 'b'] }), 'Marcar #a #b');
eq('descreve uma carta no singular', descrever({ tipo: 'cartas', pares: [{ frente: 'a', verso: 'b' }] }), 'Criar 1 carta de revisão');
if (/^Lembrar em \d/.test(descrever({ tipo: 'lembrete', quando: AGORA, texto: 'x' })))
  ok('descreve o lembrete com data'); else bad('descrição do lembrete');

{
  const antes = 'Texto da nota.';
  eq('tag entra no fim do corpo', aplicarNoConteudo({ tipo: 'tags', tags: ['bio'] }, antes), 'Texto da nota.\n\n#bio');
  eq('tag em nota vazia não deixa linha em branco na frente', aplicarNoConteudo({ tipo: 'tags', tags: ['bio'] }, ''), '#bio');
  eq(
    'seção entra como cabeçalho',
    aplicarNoConteudo({ tipo: 'secao', titulo: 'Resumo', corpo: 'Curto.' }, antes),
    'Texto da nota.\n\n## Resumo\n\nCurto.'
  );
  eq('reorganizar substitui tudo', aplicarNoConteudo({ tipo: 'reorganizar', conteudo: 'novo' }, antes), 'novo');
  // Título, lembrete e carta vão para outros lugares; o corpo não pode mudar.
  eq('título não mexe no corpo', aplicarNoConteudo({ tipo: 'titulo', titulo: 'x' }, antes), antes);
  eq('lembrete não mexe no corpo', aplicarNoConteudo({ tipo: 'lembrete', quando: 1, texto: 'x' }, antes), antes);
  eq('carta não mexe no corpo', aplicarNoConteudo({ tipo: 'cartas', pares: [] }, antes), antes);
}

console.log(`\n${pass} passaram, ${fail} falharam\n`);
process.exit(fail === 0 ? 0 : 1);
