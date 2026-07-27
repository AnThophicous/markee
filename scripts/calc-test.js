/**
 * Testes da calculadora da IA.
 *
 * O que mais importa aqui não é a matemática: é que a expressão vem do modelo,
 * que pode estar repetindo texto de uma nota ou de uma página da web. Por isso
 * metade dos casos são tentativas de fazer o analisador executar código.
 */
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../src/features/ai/tools/calculator.ts'), 'utf8');
const { outputText } = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const mod = { exports: {} };
new Function('module', 'exports', outputText)(mod, mod.exports);
const { calculate } = mod.exports;

let pass = 0, fail = 0;
const ok = (n) => { pass++; console.log('  OK   ' + n); };
const bad = (n, d) => { fail++; console.log('  FAIL ' + n + (d ? ' -> ' + d : '')); };

const eq = (expr, expected) => {
  try {
    const got = calculate(expr);
    got === String(expected) ? ok(`${expr} = ${got}`) : bad(expr, `esperado ${expected}, obtido ${got}`);
  } catch (e) { bad(expr, e.message); }
};
const rejects = (expr, why) => {
  try { const got = calculate(expr); bad(`${why}: ${expr}`, `devolveu ${got}`); }
  catch (e) { ok(`${why} [${e.message.slice(0, 40)}]`); }
};

console.log('== aritmética ==');
eq('2 + 3 * 4', 14);
eq('(2 + 3) * 4', 20);
eq('10 / 4', 2.5);
eq('2 ^ 3 ^ 2', 512);          // associativo à direita
eq('-5 + 3', -2);
eq('10 % 3', 1);
eq('1,5 + 2,5', 4);            // vírgula decimal
eq('0.1 + 0.2', 0.3);          // sem lixo de ponto flutuante

console.log('\n== funções e constantes ==');
eq('raiz(16)', 4);
eq('abs(-7)', 7);
eq('arredondar(2.6)', 3);
eq('teto(2.1)', 3);
eq('piso(2.9)', 2);
eq('log(1000)', 3);

console.log('\n== o que precisa ser recusado ==');
rejects('process.exit(1)', 'acesso ao process');
rejects('require("fs")', 'require');
rejects('globalThis', 'globalThis');
rejects('constructor.constructor("return 1")()', 'escape por constructor');
rejects('1; console.log(2)', 'sequência de comandos');
rejects('[].map(x=>x)', 'função anônima');
rejects('1/0', 'divisão por zero');
rejects('2 +', 'expressão incompleta');
rejects('(1 + 2', 'parêntese aberto');
rejects('x'.repeat(600), 'entrada gigante');
rejects('naoexiste(2)', 'função desconhecida');

console.log('\n== o process continua vivo ==');
typeof process !== 'undefined' ? ok('nada executou fora do analisador') : bad('ambiente comprometido');

console.log(`\n${pass} passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);
