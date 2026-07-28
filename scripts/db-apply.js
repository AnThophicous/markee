#!/usr/bin/env node
/**
 * Aplica UM arquivo de migração no banco remoto, dentro de uma transação.
 *
 * Existe porque `supabase db push` aplicaria todas as migrações do diretório: o
 * histórico remoto está vazio (as anteriores foram aplicadas por fora), então
 * para o CLI nenhuma delas rodou. Reexecutar dezessete migrações num banco com
 * dados de verdade, para aplicar uma, é risco sem motivo.
 *
 * Tudo numa transação só: se qualquer comando falhar, nada fica aplicado pela
 * metade. Migração aplicada parcialmente é o pior estado possível — o banco não
 * está nem na versão velha nem na nova, e descobrir onde parou é manual.
 *
 * Uso:
 *   SUPABASE_DB_URL='postgres://...' node scripts/db-apply.js supabase/migrations/0017_x.sql
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const arquivo = process.argv[2];
if (!arquivo) {
  console.error('Uso: node scripts/db-apply.js <arquivo.sql>');
  process.exit(1);
}

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('Defina SUPABASE_DB_URL com a string de conexão do banco.');
  process.exit(1);
}

const sql = fs.readFileSync(path.resolve(arquivo), 'utf8');

(async () => {
  // O Supabase exige TLS, e o certificado é de uma cadeia que o Node não traz.
  // `rejectUnauthorized: false` mantém a conexão cifrada; o que ele dispensa é
  // a verificação da cadeia. Aceitável aqui: é uma ferramenta de linha de
  // comando rodando na máquina de quem desenvolve, com o endereço vindo de
  // variável de ambiente — não é código que vai para o aplicativo.
  const cliente = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

  await cliente.connect();
  console.log(`Aplicando ${path.basename(arquivo)}…`);

  try {
    await cliente.query('begin');
    await cliente.query(sql);
    await cliente.query('commit');
    console.log('Aplicado.');
  } catch (erro) {
    await cliente.query('rollback');
    console.error('\nFALHOU — nada foi aplicado:\n' + erro.message);
    process.exitCode = 1;
  } finally {
    await cliente.end();
  }
})();
