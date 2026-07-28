#!/usr/bin/env node
/**
 * Testes do que foi aplicado no banco remoto.
 *
 * TUDO roda dentro de uma transação que termina em ROLLBACK. Nada do que este
 * arquivo escreve sobrevive: ele mexe em perfis e grupos de verdade — é esse o
 * ponto, testar o gatilho real e não uma cópia — e desfaz no fim.
 *
 * Dois detalhes que já custaram tempo em sessões anteriores:
 *
 *  - `set_config(..., true)` é local à transação. Fora de um BEGIN, o valor se
 *    perde e `auth.uid()` volta a ser nulo, o que faz uma função de segurança
 *    parecer que está negando acesso quando na verdade não recebeu ninguém.
 *
 *  - Depois de um erro, o Postgres aborta a transação inteira e todo comando
 *    seguinte falha com "current transaction is aborted". Sem SAVEPOINT, um
 *    teste que espera erro faz todos os posteriores falharem, e a saída fica
 *    cheia de falhas falsas que escondem a verdadeira.
 *
 * Não roda no CI: precisa da senha do banco, que não vai para o repositório.
 *   SUPABASE_DB_URL='postgres://...' node scripts/db-remote-test.js
 */
const { Client } = require('pg');

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('Defina SUPABASE_DB_URL.');
  process.exit(1);
}

let pass = 0;
let fail = 0;
const ok = (n) => { pass++; console.log('  OK   ' + n); };
const bad = (n, d) => { fail++; console.log('  FAIL ' + n + (d ? ' -> ' + String(d).split('\n')[0] : '')); };

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  /** Roda dentro de um savepoint: erro esperado não contamina o resto. */
  const tentar = async (sql, params) => {
    await c.query('savepoint sp');
    try {
      const r = await c.query(sql, params);
      await c.query('release savepoint sp');
      return { ok: true, r };
    } catch (e) {
      await c.query('rollback to savepoint sp');
      return { ok: false, erro: e.message };
    }
  };

  console.log('\nStatus e apelido, no banco remoto\n');

  try {
    await c.query('begin');

    /* ------------------------------------------------- colunas existem */
    const colunas = await c.query(
      `select column_name, data_type from information_schema.columns
       where table_schema = 'public' and table_name = 'profiles'
         and column_name in ('status_text','status_emoji','status_until')`
    );
    if (colunas.rows.length === 3) ok('as três colunas de status existem');
    else bad('colunas de status', colunas.rows.map((r) => r.column_name).join(','));

    const ate = colunas.rows.find((r) => r.column_name === 'status_until');
    if (ate && ate.data_type.includes('timestamp')) ok('status_until é data com fuso');
    else bad('tipo de status_until', ate && ate.data_type);

    /* ------------------------------------------- um perfil real para usar */
    const perfil = await c.query('select id from public.profiles limit 1');
    if (perfil.rows.length === 0) {
      bad('não há nenhum perfil no banco para testar');
      await c.query('rollback');
      await c.end();
      process.exit(1);
    }
    const uid = perfil.rows[0].id;
    ok('achei um perfil real para exercitar o gatilho');

    /* --------------------------------------------------- validação boa */
    let r = await tentar(
      `update public.profiles set status_text = 'Estudando pro ENEM', status_emoji = '📚' where id = $1`,
      [uid]
    );
    if (r.ok) ok('status normal é aceito'); else bad('status normal recusado', r.erro);

    r = await tentar(`update public.profiles set status_text = null, status_emoji = '🔥' where id = $1`, [uid]);
    if (r.ok) ok('emoji sem texto é aceito'); else bad('emoji sem texto', r.erro);

    r = await tentar(
      `update public.profiles set status_until = now() + interval '2 hours' where id = $1`,
      [uid]
    );
    if (r.ok) ok('validade no futuro é aceita'); else bad('validade futura', r.erro);

    /* -------------------------------------------------- validação ruim */
    r = await tentar(`update public.profiles set status_text = repeat('a', 61) where id = $1`, [uid]);
    if (!r.ok) ok('status com mais de 60 caracteres é recusado');
    else bad('status longo passou');

    r = await tentar(`update public.profiles set status_emoji = 'texto disfarçado' where id = $1`, [uid]);
    if (!r.ok) ok('letras no campo de emoji são recusadas');
    else bad('letras no emoji passaram');

    r = await tentar(
      `update public.profiles set status_until = now() - interval '1 hour' where id = $1`,
      [uid]
    );
    if (!r.ok) ok('validade no passado é recusada');
    else bad('validade no passado passou');

    /* ------------------------------------------------ um emoji só, de verdade
     *
     * Esta é a parte que a primeira versão errava. Contar caracteres não serve:
     * um emoji de família tem sete pontos de código, então o limite que deixa a
     * família passar também deixa passar doze emoji soltos — foi exatamente o
     * que este teste pegou. Por isso a lista abaixo tem os dois lados, e não só
     * os casos que deveriam ser recusados.
     */
    const emojis = [
      // aceitos: todos são UM emoji, por mais pontos de código que ocupem
      ['fogo', '🔥', true],
      ['família (junta quatro pessoas)', '👨‍👩‍👧‍👦', true],
      ['bandeira (par de indicadores)', '🇧🇷', true],
      ['joia com tom de pele', '👍🏽', true],
      ['coração com seletor de variação', '❤️', true],
      ['bandeira do arco-íris', '🏳️‍🌈', true],
      ['mulher técnica em informática', '👩‍💻', true],
      // recusados: mais de um, ou nenhum
      ['dois emoji', '🔥🔥', false],
      ['dez emoji', '🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥', false],
      ['duas bandeiras', '🇧🇷🇺🇸', false],
      ['fogo mais família', '🔥👨‍👩‍👧‍👦', false],
      ['duas famílias', '👨‍👩‍👧‍👦👨‍👩‍👧‍👦', false],
      ['só juntadores, não desenha nada', '‍‍', false],
    ];

    for (const [nome, valor, deveAceitar] of emojis) {
      const t = await tentar('update public.profiles set status_emoji = $2 where id = $1', [uid, valor]);
      if (t.ok === deveAceitar) ok(`emoji: ${nome} — ${deveAceitar ? 'aceito' : 'recusado'}`);
      else if (deveAceitar) bad(`emoji legítimo recusado: ${nome}`, t.erro);
      else bad(`emoji indevido aceito: ${nome}`);
    }

    // O campo em branco tem de virar nulo, e não "emoji vazio".
    await tentar(`update public.profiles set status_emoji = '  ' where id = $1`, [uid]);
    const semEmoji = await c.query('select status_emoji from public.profiles where id = $1', [uid]);
    if (semEmoji.rows[0].status_emoji === null) ok('emoji só com espaços vira nulo');
    else bad('emoji em branco', JSON.stringify(semEmoji.rows[0].status_emoji));

    // Texto só com espaços vira nulo em vez de status em branco.
    await tentar(`update public.profiles set status_text = '   ' where id = $1`, [uid]);
    const branco = await c.query('select status_text from public.profiles where id = $1', [uid]);
    if (branco.rows[0].status_text === null) ok('status só com espaços vira nulo');
    else bad('status em branco', JSON.stringify(branco.rows[0].status_text));

    /* ------------------------------------------------------- apelido */
    const grupo = await c.query(
      'select group_id from public.group_members where user_id = $1 limit 1',
      [uid]
    );

    if (grupo.rows.length === 0) {
      console.log('  --   sem grupo para este perfil; pulando os testes de apelido');
    } else {
      const gid = grupo.rows[0].group_id;

      // auth.uid() sai daqui. Local à transação, some no rollback.
      await c.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: uid, role: 'authenticated' }),
      ]);

      r = await tentar('select public.set_nickname($1, $2)', [gid, 'Apelido de Teste']);
      if (r.ok) ok('set_nickname grava o apelido'); else bad('set_nickname falhou', r.erro);

      const lido = await c.query(
        'select nickname from public.group_members where group_id = $1 and user_id = $2',
        [gid, uid]
      );
      if (lido.rows[0]?.nickname === 'Apelido de Teste') ok('o apelido foi mesmo gravado');
      else bad('apelido não gravou', JSON.stringify(lido.rows[0]));

      r = await tentar('select public.set_nickname($1, $2)', [gid, '   ']);
      const limpo = await c.query(
        'select nickname from public.group_members where group_id = $1 and user_id = $2',
        [gid, uid]
      );
      if (limpo.rows[0]?.nickname === null) ok('apelido em branco volta a ser o nome real');
      else bad('apelido em branco', JSON.stringify(limpo.rows[0]));

      r = await tentar('select public.set_nickname($1, $2)', [gid, 'x'.repeat(33)]);
      if (!r.ok) ok('apelido com mais de 32 caracteres é recusado');
      else bad('apelido longo passou');

      // O ponto de segurança: em grupo do qual não se faz parte, a função tem
      // de recusar em vez de não fazer nada em silêncio.
      const outro = await c.query(
        `select id from public.groups where id not in (
           select group_id from public.group_members where user_id = $1
         ) limit 1`,
        [uid]
      );
      if (outro.rows.length > 0) {
        r = await tentar('select public.set_nickname($1, $2)', [outro.rows[0].id, 'Invasor']);
        if (!r.ok) ok('apelido em grupo alheio é recusado');
        else bad('conseguiu apelidar em grupo que não é dele');
      } else {
        console.log('  --   não há grupo alheio para testar; pulando');
      }
    }

    /* --------------------------------------------------- apagar um grupo
     *
     * "Nem dá para apagar grupo" foi um relato de quem usa, e o defeito estava
     * na interface — não havia caminho até o botão. Mesmo assim o servidor
     * entra aqui: se um dia a `delete_group` parar de funcionar, o sintoma vai
     * ser exatamente o mesmo, e sem este teste a busca começaria de novo pela
     * interface.
     */
    const gidNovo = (
      await c.query(
        `insert into public.groups (name, owner_id, join_code)
         values ('Grupo de teste automatizado', $1, 'zztest1') returning id`,
        [uid]
      )
    ).rows[0].id;

    // Conteúdo dentro: é o caso real, e é onde uma chave estrangeira sem
    // CASCADE apareceria — o DELETE falharia só em grupo que já foi usado.
    const salaNova = (
      await c.query(
        `insert into public.rooms (group_id, name, kind) values ($1, 'geral', 'chat') returning id`,
        [gidNovo]
      )
    ).rows[0].id;
    await c.query(`insert into public.messages (room_id, author_id, content) values ($1, $2, 'oi')`, [
      salaNova,
      uid,
    ]);

    await c.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ sub: uid, role: 'authenticated' }),
    ]);

    r = await tentar('select public.delete_group($1)', [gidNovo]);
    if (r.ok) ok('o dono apaga o próprio grupo, mesmo com sala e mensagem dentro');
    else bad('delete_group falhou para o dono', r.erro);

    const sobrou = await c.query('select count(*)::int as n from public.groups where id = $1', [gidNovo]);
    if (sobrou.rows[0].n === 0) ok('o grupo some mesmo do banco');
    else bad('o grupo continuou lá depois do delete_group');

    // E o não-dono precisa ser recusado com erro, não em silêncio: um UPDATE ou
    // DELETE que não acha nada não é erro em SQL, e o app não teria como
    // distinguir "recusado" de "deu certo".
    const alheio = await c.query('select id from public.groups where owner_id <> $1 limit 1', [uid]);
    if (alheio.rows.length > 0) {
      r = await tentar('select public.delete_group($1)', [alheio.rows[0].id]);
      if (!r.ok) ok('quem não é dono é recusado com erro ao tentar apagar');
      else bad('NÃO-DONO APAGOU GRUPO ALHEIO');
    } else {
      console.log('  --   não há grupo de outro dono para testar; pulando');
    }

    /* ----------------------------------------------- o Pro é do servidor
     *
     * Nada aqui olha para o aplicativo. Roda como a conta free de verdade e
     * tenta gravar recurso pago direto no banco — que é exatamente o que um APK
     * modificado consegue fazer. Se o gatilho recusa aqui, mexer no app não
     * adianta.
     *
     * Testa os dois lados de propósito: um bloqueio que recusa todo mundo
     * também "passaria" num teste que só olha o free, e estaria quebrado.
     */
    const contaFree = (
      await c.query(`select id from public.profiles where public.current_plan(id) = 'free' limit 1`)
    ).rows[0];
    const contaPro = (
      await c.query(`select id from public.profiles where public.current_plan(id) = 'pro' limit 1`)
    ).rows[0];

    const PAGOS = [
      ['gradiente', `update public.profiles set profile_theme = '{"kind":"gradient","colors":["#ff0000","#0000ff"],"effect":"none"}'::jsonb where id = $1`],
      ['efeito', `update public.profiles set profile_theme = '{"kind":"solid","colors":["#ff0000"],"effect":"glow"}'::jsonb where id = $1`],
      ['banner', `update public.profiles set banner_url = 'https://exemplo/x.png' where id = $1`],
    ];

    if (contaFree) {
      await c.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: contaFree.id, role: 'authenticated' }),
      ]);
      for (const [nome, sql] of PAGOS) {
        const t = await tentar(sql, [contaFree.id]);
        if (!t.ok && t.erro.includes('PRO_REQUIRED')) ok(`conta free é recusada ao gravar ${nome}`);
        else if (t.ok) bad(`FURO: conta free gravou ${nome} direto no banco`);
        else bad(`free recusada em ${nome}, mas por outro motivo`, t.erro);
      }
    } else {
      console.log('  --   nenhuma conta free para testar o bloqueio; pulando');
    }

    if (contaPro) {
      await c.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: contaPro.id, role: 'authenticated' }),
      ]);
      for (const [nome, sql] of PAGOS) {
        const t = await tentar(sql, [contaPro.id]);
        if (t.ok) ok(`conta pro grava ${nome} normalmente`);
        else bad(`o bloqueio está recusando quem pagou (${nome})`, t.erro);
      }
    } else {
      console.log('  --   nenhuma conta pro para testar o outro lado; pulando');
    }

    /* ------------------------------- o modelo de transcrição sai do plano */
    const modelos = await c.query(
      'select id, transcribe_model, transcribe_min_month from public.plans order by price_cents'
    );
    const porPlano = Object.fromEntries(
      modelos.rows.map((r) => [r.id, { modelo: r.transcribe_model, min: r.transcribe_min_month }])
    );

    if (porPlano.free?.modelo && porPlano.pro?.modelo) ok('todo plano tem modelo de transcrição');
    else bad('plano sem modelo', JSON.stringify(porPlano));

    // O caro para quem paga. Se os dois fossem iguais, a conta grátis estaria
    // consumindo o modelo de US$ 0,006/min e ninguém perceberia até a fatura.
    if (porPlano.free?.modelo !== porPlano.pro?.modelo) {
      ok('o plano pago usa um modelo diferente do grátis');
    } else bad('grátis e pago usam o mesmo modelo', porPlano.free?.modelo);

    if ((porPlano.pro?.min ?? 0) > (porPlano.free?.min ?? 0)) ok('o plano pago tem mais minutos');
    else bad('minutos do pago não superam o grátis', JSON.stringify(porPlano));

    // Cada conta enxerga o modelo do SEU plano, e não o de outro: é esta função
    // que a borda consulta antes de chamar a OpenAI.
    if (contaFree) {
      await c.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: contaFree.id, role: 'authenticated' }),
      ]);
      const cfg = (await c.query('select * from public.my_transcribe_config()')).rows[0];
      if (cfg?.model === porPlano.free.modelo) ok('conta free recebe o modelo do plano free');
      else bad('modelo errado para conta free', JSON.stringify(cfg));
      // O limite deixou de ser "minutos por mês" e virou saldo de crédito; o
      // que a borda precisa saber agora é o PREÇO do minuto, para debitar.
      if (Number(cfg?.usd_min) === 0.003) ok('conta free recebe o preço do minuto do modelo simples');
      else bad('preço do minuto errado para conta free', JSON.stringify(cfg));
    }

    if (contaPro) {
      await c.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: contaPro.id, role: 'authenticated' }),
      ]);
      const cfg = (await c.query('select * from public.my_transcribe_config()')).rows[0];
      if (cfg?.model === porPlano.pro.modelo) ok('conta pro recebe o modelo do plano pro');
      else bad('modelo errado para conta pro', JSON.stringify(cfg));
      if (Number(cfg?.usd_min) === 0.006) ok('conta pro recebe o preço do minuto do modelo bom');
      else bad('preço do minuto errado para conta pro', JSON.stringify(cfg));
    }

    // Estourar a cota tem de dar EXCEÇÃO, e não devolver zero em silêncio: a
    // borda distingue os dois casos pela mensagem QUOTA_EXCEEDED.
    if (contaFree) {
      // Volta para a conta free ANTES de medir. O bloco acima deixou a sessão
      // como a conta pro, e sem isto os minutos seriam conferidos contra o
      // limite de 300 em vez do de 15 — o teste passava por engano e reclamava
      // de um furo que não existia.
      await c.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: contaFree.id, role: 'authenticated' }),
      ]);

      // Gastar mais do que o saldo tem de dar EXCEÇÃO, e não devolver zero em
      // silêncio: a borda distingue os dois casos pela mensagem NO_CREDITS.
      await c.query('select public.claim_monthly_credits()');
      const saldo = (await c.query('select public.credit_balance(auth.uid()) as n')).rows[0].n;
      const t = await tentar(`select public.consume_credits($1, 'teste')`, [
        (saldo + 1) * 0.003,
      ]);
      if (!t.ok && t.erro.includes('NO_CREDITS')) ok('gastar mais crédito do que o saldo é recusado');
      else if (t.ok) bad('FURO: gastou mais crédito do que tinha');
      else bad('recusou por outro motivo', t.erro);

      // E o depósito do mês não pode duplicar por chamada repetida.
      await c.query('select public.claim_monthly_credits()');
      await c.query('select public.claim_monthly_credits()');
      const depois = (await c.query('select public.credit_balance(auth.uid()) as n')).rows[0].n;
      if (depois === saldo) ok('chamar o depósito mensal de novo não credita duas vezes');
      else bad('o depósito mensal duplicou', `${saldo} -> ${depois}`);
    }

    // E o plano tem de sair da assinatura, nunca de um padrão generoso: uma
    // conta sem assinatura nenhuma precisa cair em free.
    const semAssinatura = await c.query(
      `select public.current_plan('00000000-0000-0000-0000-000000000000'::uuid) as plano`
    );
    if (semAssinatura.rows[0].plano === 'free') ok('conta sem assinatura é free, não pro');
    else bad('conta sem assinatura virou', semAssinatura.rows[0].plano);

    /* ------------------------------------- a função não deixa se promover */
    const corpo = await c.query(
      `select pg_get_functiondef(oid) as def from pg_proc
       where proname = 'set_nickname' and pronamespace = 'public'::regnamespace`
    );
    const def = corpo.rows[0]?.def ?? '';
    if (def.includes('nickname =') && !def.includes('role_id')) {
      ok('set_nickname altera só o apelido — não encosta em role_id');
    } else {
      bad('set_nickname mexe em outra coluna além do apelido');
    }

    await c.query('rollback');
    console.log('\n(transação revertida — nada foi alterado de verdade)');
  } catch (e) {
    await c.query('rollback').catch(() => {});
    bad('erro inesperado', e.message);
  } finally {
    await c.end();
  }

  console.log(`\n${pass} passaram, ${fail} falharam\n`);
  process.exit(fail > 0 ? 1 : 0);
})();
