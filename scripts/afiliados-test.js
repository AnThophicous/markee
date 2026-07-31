/**
 * Testes do programa de afiliados.
 *
 * O que se testa aqui é PEQUENO de propósito, e vale dizer por quê: quase todo
 * o programa vive no banco. Valor de comissão, saldo, quem indicou quem e o
 * resgate são calculados por funções SECURITY DEFINER, e o aplicativo não
 * participa de nenhum desses cálculos.
 *
 * Isso não é falta de teste — é onde a regra mora. Se a comissão fosse somada
 * aqui, um APK modificado somaria outra coisa. O que sobra para o cliente é ler
 * um código de um texto e formatar dinheiro na tela, e é exatamente isso que
 * está testado.
 *
 * A parte de baixo confere o SQL como TEXTO, procurando as concessões perigosas.
 * É teste grosseiro e pega o defeito que mais custaria: um `grant execute` a
 * mais em record_pro_purchase e qualquer conta passa a poder se dar comissão.
 */
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../src/features/billing/afiliado.ts'), 'utf8');
const { outputText } = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const mod = { exports: {} };
new Function('module', 'exports', outputText)(mod, mod.exports);
const {
  lerCodigoDeAfiliado,
  linkDeAfiliado,
  textoDoConvite,
  emReais,
  emPorcento,
  faltaParaResgatar,
  creditosDoResgate,
  descreverErroDeAfiliado,
} = mod.exports;

let pass = 0;
let fail = 0;
const ok = (n) => { pass++; console.log('  OK   ' + n); };
const bad = (n, d) => { fail++; console.log('  FAIL ' + n + (d !== undefined ? ' -> ' + d : '')); };
const eq = (n, a, b) => (a === b ? ok(n) : bad(n, `esperava ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`));

console.log('\nAfiliados\n');

/* ------------------------------------------------------ ler o código */
const CODIGO = 'a1b2c3d4';

eq('link do site', lerCodigoDeAfiliado(`https://markee.app/i/${CODIGO}`), CODIGO);
eq('link do app', lerCodigoDeAfiliado(`markee://add/a/${CODIGO}`), CODIGO);
eq('link do app sem o add', lerCodigoDeAfiliado(`markee://a/${CODIGO}`), CODIGO);
eq('código digitado', lerCodigoDeAfiliado(CODIGO), CODIGO);
eq('com espaço em volta', lerCodigoDeAfiliado(`  ${CODIGO}  `), CODIGO);
eq('em maiúsculas', lerCodigoDeAfiliado(CODIGO.toUpperCase()), CODIGO);

// Nunca chuta: chutar aqui manda a comissão de alguém para a pessoa errada.
eq('texto qualquer não vira código', lerCodigoDeAfiliado('vem usar o markee'), null);
eq('código curto demais', lerCodigoDeAfiliado('a1b2'), null);
eq('código longo demais', lerCodigoDeAfiliado('a1b2c3d4e5'), null);
eq('com letra fora do hexadecimal', lerCodigoDeAfiliado('a1b2c3dz'), null);
eq('vazio', lerCodigoDeAfiliado(''), null);
eq('link de amigo não é link de afiliado', lerCodigoDeAfiliado(`markee://add/u/${CODIGO}`), null);
eq('link de grupo também não', lerCodigoDeAfiliado(`markee://add/g/${CODIGO}`), null);

{
  // Ida e volta: o link que a tela mostra é lido de volta pelo mesmo código.
  const voltou = lerCodigoDeAfiliado(linkDeAfiliado(CODIGO));
  eq('o link gerado é lido de volta', voltou, CODIGO);
  const noConvite = lerCodigoDeAfiliado(textoDoConvite(CODIGO).split('\n').pop());
  eq('e o texto do convite carrega o código certo', noConvite, CODIGO);
}

/* --------------------------------------------------------- o dinheiro */
eq('centavos viram reais', emReais(990), 'R$ 9,90');
eq('valor redondo mantém os centavos', emReais(500), 'R$ 5,00');
eq('zero aparece como zero', emReais(0), 'R$ 0,00');
eq('valor quebrado', emReais(297), 'R$ 2,97');
eq('fração vira porcentagem', emPorcento(0.3), '30%');
eq('e a recorrente também', emPorcento(0.1), '10%');

eq('falta o que falta', faltaParaResgatar(200, 500), 300);
eq('em cima do mínimo, não falta nada', faltaParaResgatar(500, 500), 0);
eq('acima do mínimo também não', faltaParaResgatar(900, 500), 0);

{
  // O pacote de 100 créditos custa R$ 3,90, então 100/390 créditos por centavo.
  const porCredito = 100 / 390;
  eq('resgate de R$ 5,00 em créditos', creditosDoResgate(500, porCredito), 128);
  eq('sem saldo, nenhum crédito', creditosDoResgate(0, porCredito), 0);
  // Arredonda para BAIXO: creditar a mais sai do nosso bolso a cada resgate.
  eq('arredonda para baixo', creditosDoResgate(1, porCredito), 0);
}

/* ------------------------------------------------------- as mensagens */
eq('já indicado', descreverErroDeAfiliado('AFILIADO:ja_indicado').includes('já tem'), true);
eq('tarde demais', descreverErroDeAfiliado('AFILIADO:tarde_demais').includes('primeiros dias'), true);
eq('código inválido', descreverErroDeAfiliado('AFILIADO:codigo_invalido').includes('não existe'), true);
eq('o próprio código', descreverErroDeAfiliado('AFILIADO:voce_mesmo').includes('seu próprio'), true);
eq(
  'abaixo do mínimo diz QUAL é o mínimo',
  descreverErroDeAfiliado('AFILIADO:abaixo_do_minimo:500').includes('R$ 5,00'),
  true
);
eq('erro do Postgres não é traduzido', descreverErroDeAfiliado('duplicate key value'), null);

/* ================================================== o SQL, como texto */
const sql = fs.readFileSync(path.join(__dirname, '../supabase/migrations/0028_afiliados.sql'), 'utf8');
const semComentarios = sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

{
  // A função que cria comissão. Um grant a mais aqui e qualquer conta se dá
  // dinheiro — é o defeito mais caro que este arquivo pode ter.
  const concede = /grant execute on function public\.record_pro_purchase/i.test(semComentarios);
  eq('record_pro_purchase NÃO é concedida a ninguém', concede, false);

  const revoga = /revoke all on function public\.record_pro_purchase[\s\S]{0,120}authenticated/i.test(
    semComentarios
  );
  eq('e é revogada explicitamente de authenticated', revoga, true);
}

{
  // A tabela de comissões só pode ter política de leitura.
  const politicas = [...semComentarios.matchAll(/create policy[^;]*?on public\.affiliate_commissions[^;]*;/gi)];
  eq('affiliate_commissions tem uma política só', politicas.length, 1);
  eq('e ela é de select', /for select/i.test(politicas[0]?.[0] ?? ''), true);
  eq('restrita ao dono', /referrer_id = auth\.uid\(\)/.test(politicas[0]?.[0] ?? ''), true);
}

{
  // As colunas de indicação não podem ser escritas por UPDATE direto.
  eq('o UPDATE de profiles é revogado', /revoke update on public\.profiles from authenticated/i.test(semComentarios), true);
  const concessao = semComentarios.match(/grant update \(([\s\S]*?)\) on public\.profiles/i);
  eq('e reconcedido coluna a coluna', Boolean(concessao), true);
  const colunas = (concessao?.[1] ?? '').split(',').map((c) => c.trim());
  for (const proibida of ['affiliate_code', 'referred_by', 'referred_at']) {
    eq(`${proibida} fica de fora`, colunas.includes(proibida), false);
  }
  // E as que a tela precisa continuam lá, senão salvar o perfil quebra.
  for (const precisa of ['display_name', 'avatar_url', 'profile_theme', 'updated_at']) {
    eq(`${precisa} continua editável`, colunas.includes(precisa), true);
  }
}

{
  eq(
    'a comissão não pode apontar para quem comprou',
    /referrer_id <> buyer_id/.test(semComentarios),
    true
  );
  eq('e a compra da loja é única', /ref\s+text not null unique/i.test(semComentarios), true);
}

console.log(`\n${pass} passaram, ${fail} falharam\n`);
process.exit(fail === 0 ? 0 : 1);
