/**
 * Testes do laço de ferramentas.
 *
 * O modelo é simulado: o que está em teste é o PROTOCOLO — se o app entende a
 * decisão do modelo, se para quando deve, e principalmente se ele se comporta
 * quando o modelo desobedece o formato (o que acontece bastante com o roteador
 * gratuito, que sorteia um modelo diferente a cada chamada).
 */
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

// O agente importa o registro de ferramentas, que puxa o supabase e o SQLite.
// Aqui só interessa o protocolo, então as ferramentas são substituídas.
const src = fs.readFileSync(path.join(__dirname, '../src/features/ai/services/agent.ts'), 'utf8');
const stubbed = src.replace(/import[\s\S]*?from '\.\.\/tools\/registry';/, `
const TOOLS = [
  { name: 'buscar', description: 'busca', argumentHint: 'x', run: async (a) => 'RESULTADO DA BUSCA sobre ' + a },
  { name: 'calcular', description: 'calc', argumentHint: 'x', run: async (a) => a + ' = 42' },
  { name: 'minhas_notas', description: 'notas', argumentHint: 'x', needsPermission: 'notes', run: async () => 'CONTEUDO DA NOTA' },
  { name: 'data', description: 'data', argumentHint: '', run: async () => 'Hoje e 27/07/2026' },
];
const findTool = (n) => TOOLS.find((t) => t.name === n.trim().toLowerCase());
`).replace(/import type[\s\S]*?from '\.\.\/tools\/types';/, '');

const { outputText } = ts.transpileModule(stubbed, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const mod = { exports: {} };
new Function('module', 'exports', outputText)(mod, mod.exports);
const { runAgent, parseStep } = mod.exports;

let pass = 0, fail = 0;
const ok = (n) => { pass++; console.log('  OK   ' + n); };
const bad = (n, d) => { fail++; console.log('  FAIL ' + n + (d ? ' -> ' + d : '')); };

/** Modelo falso: devolve as respostas na ordem. */
const scripted = (...replies) => {
  let i = 0;
  const seen = [];
  const fn = async (prompt) => { seen.push(prompt); return replies[Math.min(i++, replies.length - 1)]; };
  fn.prompts = seen;
  return fn;
};

(async () => {
  console.log('== leitura da decisão ==');
  let s = parseStep('FERRAMENTA: buscar\nARGUMENTO: enem 2026 datas');
  (s.kind === 'tool' && s.tool === 'buscar' && s.argument === 'enem 2026 datas')
    ? ok('chamada de ferramenta') : bad('chamada', JSON.stringify(s));

  s = parseStep('RESPOSTA: A prova é em novembro.');
  (s.kind === 'answer' && s.text === 'A prova é em novembro.') ? ok('resposta final') : bad('resposta', JSON.stringify(s));

  s = parseStep('O ENEM costuma cair em novembro.');
  (s.kind === 'answer') ? ok('modelo que ignorou o formato ainda é aproveitado') : bad('texto solto', JSON.stringify(s));

  console.log('\n== laço ==');
  let r = await runAgent('quando é o enem?', {
    complete: scripted('FERRAMENTA: buscar\nARGUMENTO: enem 2026', 'RESPOSTA: Em novembro de 2026.'),
    allowNotes: false,
  });
  (r.text === 'Em novembro de 2026.' && r.traces.length === 1 && r.traces[0].tool === 'buscar')
    ? ok('busca e depois responde') : bad('laço básico', JSON.stringify(r));

  r = await runAgent('quanto é isso', {
    complete: scripted('FERRAMENTA: calcular\nARGUMENTO: 6*7', 'RESPOSTA: 42.'),
    allowNotes: false,
  });
  r.traces[0].result.includes('42') ? ok('resultado da ferramenta volta ao modelo') : bad('resultado', JSON.stringify(r.traces));

  console.log('\n== permissão das notas ==');
  r = await runAgent('o que anotei?', {
    complete: scripted('FERRAMENTA: minhas_notas\nARGUMENTO: biologia', 'RESPOSTA: Preciso de acesso.'),
    allowNotes: false,
  });
  (r.traces[0].failed && !r.traces[0].result.includes('CONTEUDO'))
    ? ok('notas bloqueadas sem permissão') : bad('VAZOU A NOTA', JSON.stringify(r.traces[0]));

  r = await runAgent('o que anotei?', {
    complete: scripted('FERRAMENTA: minhas_notas\nARGUMENTO: biologia', 'RESPOSTA: Você anotou X.'),
    allowNotes: true,
  });
  r.traces[0].result.includes('CONTEUDO') ? ok('notas liberadas com permissão') : bad('permissão não funcionou');

  // A ferramenta nem aparece no prompt quando não há permissão.
  const spy = scripted('RESPOSTA: ok');
  await runAgent('oi', { complete: spy, allowNotes: false });
  !spy.prompts[0].includes('minhas_notas')
    ? ok('ferramenta de notas nem é oferecida ao modelo') : bad('notas apareceram no prompt');

  console.log('\n== casos ruins ==');
  r = await runAgent('x', {
    complete: scripted('FERRAMENTA: inventada\nARGUMENTO: y', 'RESPOSTA: Desculpe.'),
    allowNotes: false,
  });
  r.traces[0].failed ? ok('ferramenta inexistente é recusada') : bad('ferramenta fantasma aceita');

  // Modelo teimoso: só pede ferramenta, nunca responde.
  r = await runAgent('x', {
    complete: scripted('FERRAMENTA: buscar\nARGUMENTO: a'),
    allowNotes: false,
  });
  (r.traces.length <= 4 && r.text.length > 0)
    ? ok(`laço infinito cortado (${r.traces.length} passos, ainda respondeu)`) : bad('laço não parou', JSON.stringify(r));

  r = await runAgent('x', { complete: scripted(''), allowNotes: false });
  (typeof r.text === 'string') ? ok('resposta vazia não quebra') : bad('vazio quebrou');

  console.log(`\n${pass} passaram, ${fail} falharam`);
  process.exit(fail ? 1 : 0);
})();
