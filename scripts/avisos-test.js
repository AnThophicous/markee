/**
 * Testes da faixa de avisos.
 *
 * O que se garante aqui é que ela não vira barulho. O salvamento automático da
 * nota tenta a cada 600ms; sem deduplicação, uma falha de rede viraria a mesma
 * frase piscando dezenas de vezes por minuto, e a pessoa aprenderia a ignorar a
 * faixa — que é o mesmo que ela não existir.
 *
 * A tradução também é testada: mensagem de Postgres na cara de quem usa não
 * informa nada. "new row violates row-level security policy" não conta a
 * ninguém que faltou permissão.
 */
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../src/services/avisos.ts'), 'utf8');
const { outputText } = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const mod = { exports: {} };
new Function('module', 'exports', 'setTimeout', 'clearTimeout', outputText)(
  mod,
  mod.exports,
  setTimeout,
  clearTimeout
);
const { avisar, limparAviso, assinarAvisos, emPortugues } = mod.exports;

let pass = 0;
let fail = 0;
const ok = (n) => { pass++; console.log('  OK   ' + n); };
const bad = (n, d) => { fail++; console.log('  FAIL ' + n + (d !== undefined ? ' -> ' + d : '')); };

console.log('\nFaixa de avisos\n');

/** Coleta tudo o que a faixa mostrou, ignorando os apagamentos. */
function gravar() {
  const vistos = [];
  const parar = assinarAvisos((a) => { if (a) vistos.push(a); });
  return { vistos, parar };
}

(async () => {
  /* ------------------------------------------------------- o básico */
  {
    limparAviso();
    const { vistos, parar } = gravar();
    avisar('Deu ruim');
    if (vistos.length === 1 && vistos[0].texto === 'Deu ruim') ok('o aviso chega a quem assinou');
    else bad('aviso não chegou', JSON.stringify(vistos));
    if (vistos[0]?.tom === 'erro') ok('o tom padrão é erro');
    else bad('tom padrão', vistos[0]?.tom);
    parar();
    limparAviso();
  }

  /* ------------------------------- quem assina depois vê o que está na tela */
  {
    limparAviso();
    avisar('Já estava aqui');
    let recebido = null;
    const parar = assinarAvisos((a) => { recebido = a; });
    if (recebido && recebido.texto === 'Já estava aqui') {
      ok('quem assina depois recebe o aviso que já estava na tela');
    } else bad('estado inicial não entregue', JSON.stringify(recebido));
    parar();
    limparAviso();
  }

  /* --------------------------------------------------- deduplicação */
  {
    limparAviso();
    const { vistos, parar } = gravar();
    // Exatamente o caso do salvamento automático falhando em sequência.
    for (let i = 0; i < 20; i++) avisar('Sem conexão com o servidor. Tente de novo.');
    if (vistos.length === 1) ok('vinte falhas iguais seguidas viram um aviso só');
    else bad('a mesma mensagem repetiu', vistos.length);
    parar();
    limparAviso();
  }

  {
    limparAviso();
    const { vistos, parar } = gravar();
    avisar('Primeiro erro');
    avisar('Segundo erro, diferente');
    if (vistos.length === 2) ok('mensagem diferente aparece por cima da anterior');
    else bad('mensagem diferente não apareceu', vistos.length);
    parar();
    limparAviso();
  }

  {
    limparAviso();
    const { vistos, parar } = gravar();
    avisar('Mesmo texto');
    avisar('Mesmo texto', 'ok');
    if (vistos.length === 2) ok('mesmo texto com tom diferente não é considerado repetido');
    else bad('tom diferente foi deduplicado', vistos.length);
    parar();
    limparAviso();
  }

  /* ------------------------------------------------- ids e vazios */
  {
    limparAviso();
    const { vistos, parar } = gravar();
    avisar('Um');
    avisar('Dois');
    if (vistos[0].id !== vistos[1].id) ok('cada aviso tem id próprio, para a animação repetir');
    else bad('ids iguais', vistos[0].id);
    parar();
    limparAviso();
  }

  {
    limparAviso();
    const { vistos, parar } = gravar();
    avisar('');
    avisar('   ');
    if (vistos.length === 0) ok('texto vazio ou só espaços não vira aviso');
    else bad('vazio virou aviso', JSON.stringify(vistos));
    parar();
    limparAviso();
  }

  /* ------------------------------------- ouvinte que explode não derruba */
  {
    limparAviso();
    let outroRecebeu = false;
    const pararRuim = assinarAvisos(() => { throw new Error('ouvinte quebrado'); });
    const pararBom = assinarAvisos((a) => { if (a) outroRecebeu = true; });
    try {
      avisar('Mensagem depois do ouvinte quebrado');
      ok('um ouvinte que lança exceção não derruba o aviso');
    } catch (e) {
      bad('a exceção do ouvinte vazou', e.message);
    }
    if (outroRecebeu) ok('os outros ouvintes recebem mesmo assim');
    else bad('o ouvinte bom ficou sem receber');
    pararRuim();
    pararBom();
    limparAviso();
  }

  /* ---------------------------------------------- cancelar a assinatura */
  {
    limparAviso();
    let contou = 0;
    const parar = assinarAvisos((a) => { if (a) contou++; });
    avisar('Antes de cancelar');
    parar();
    avisar('Depois de cancelar');
    if (contou === 1) ok('depois de cancelar, não recebe mais nada');
    else bad('recebeu depois de cancelar', contou);
    limparAviso();
  }

  /* ------------------------------------------------- some sozinho */
  {
    limparAviso();
    let ultimo = 'ainda não';
    const parar = assinarAvisos((a) => { ultimo = a; });
    avisar('Some daqui a pouco');
    if (ultimo !== null) ok('o aviso fica na tela logo depois de avisar');
    else bad('sumiu na hora');

    await new Promise((r) => setTimeout(r, 5300));
    if (ultimo === null) ok('o aviso some sozinho depois de alguns segundos');
    else bad('o aviso não sumiu', JSON.stringify(ultimo));
    parar();
    limparAviso();
  }

  /* --------------------------------------------------------- tradução */
  {
    const casos = [
      ['new row violates row-level security policy for table "group_members"', 'permissão'],
      ['permission denied for table groups', 'permissão'],
      ['Network request failed', 'conexão'],
      ['TypeError: Failed to fetch', 'conexão'],
      ['JWT expired', 'sessão'],
      ['duplicate key value violates unique constraint', 'já existe'],
    ];
    let erros = 0;
    for (const [cru, esperado] of casos) {
      const traduzido = emPortugues(cru).toLowerCase();
      if (!traduzido.includes(esperado)) {
        erros++;
        console.log(`  FAIL tradução de "${cru.slice(0, 40)}…" -> "${traduzido}"`);
      }
    }
    if (erros === 0) ok('as mensagens técnicas viram frases que dá para ler');
    else fail += erros;

    // As do nosso próprio banco já vêm prontas e não podem ser reescritas.
    const nossa = 'O status precisa ter no máximo 60 caracteres.';
    if (emPortugues(nossa) === nossa) ok('mensagem que já está em português passa intacta');
    else bad('reescreveu uma mensagem boa', emPortugues(nossa));

    if (emPortugues('Só o dono pode apagar o grupo.') === 'Só o dono pode apagar o grupo.') {
      ok('a mensagem do delete_group chega inteira a quem usa');
    } else bad('mensagem do delete_group alterada');
  }

  console.log(`\n${pass} passaram, ${fail} falharam\n`);
  process.exit(fail > 0 ? 1 : 0);
})();
