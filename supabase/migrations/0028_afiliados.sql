-- Programa de afiliados: quem traz um assinante ganha uma parte do que ele paga.
--
-- A REGRA QUE DECIDE O DESENHO INTEIRO: o aplicativo nunca cria uma comissão.
-- Nem uma linha, nem um centavo. O app só faz duas coisas — mostrar o próprio
-- link e dizer "fui indicado por este código" no começo da vida da conta. Quem
-- credita é o servidor, e só depois de a loja confirmar que o dinheiro entrou.
--
-- Isso não é excesso de zelo. Dinheiro é o único lugar do app onde trapacear
-- compensa: com o código aberto e a chave publicável dentro do APK, um INSERT
-- liberado em affiliate_commissions seria a primeira coisa que alguém tentaria,
-- e daria certo. Por isso a tabela não tem política de INSERT nenhuma e
-- record_pro_purchase é revogada de `authenticated`.
--
-- O que o app PODE fazer sem risco é resgatar: transformar comissão que o
-- servidor já reconheceu em crédito de IA. Mexer nesse dinheiro não cria
-- dinheiro novo.

-- --------------------------------------------------------------- 1. O CÓDIGO

/**
 * O código de afiliado é SEPARADO do friend_code de propósito.
 *
 * O friend_code pode ser regenerado (regenerate_friend_code existe justo para
 * quem espalhou o QR e se arrependeu). Se ele valesse como link de afiliado,
 * regenerar quebraria em silêncio todo link já publicado — e o prejuízo cairia
 * em cima de quem divulgou, meses depois, sem nenhum aviso.
 *
 * Este aqui não tem função de regenerar. Nasce com a conta e morre com ela.
 */
alter table public.profiles
  add column if not exists affiliate_code text,
  add column if not exists referred_by    uuid references public.profiles(id) on delete set null,
  add column if not exists referred_at    timestamptz;

update public.profiles
set affiliate_code = encode(extensions.gen_random_bytes(4), 'hex')
where affiliate_code is null;

alter table public.profiles
  alter column affiliate_code set default encode(extensions.gen_random_bytes(4), 'hex'),
  alter column affiliate_code set not null;

create unique index if not exists idx_profiles_affiliate_code
  on public.profiles (affiliate_code);

create index if not exists idx_profiles_referred_by
  on public.profiles (referred_by) where referred_by is not null;

/**
 * Ninguém escreve nessas colunas por UPDATE direto.
 *
 * A política de UPDATE de profiles é "id = auth.uid()" — o dono edita o próprio
 * perfil, e isso passou a incluir qualquer coluna nova que a gente adicionasse.
 * Sem o que vem abaixo, `update profiles set referred_by = <vítima>` seria uma
 * chamada de API, e a comissão de todo mundo passaria a cair na conta de quem
 * tentou. `affiliate_code` livre seria pior ainda: dava para assumir o código
 * de outra pessoa e roubar os links já divulgados.
 *
 * A proteção é PRIVILÉGIO DE COLUNA, não gatilho. O Postgres recusa antes de
 * qualquer linha ser tocada, não há o que desligar e nada trava a tabela. As
 * funções SECURITY DEFINER daqui de baixo rodam como a dona da tabela, então
 * elas continuam podendo escrever.
 *
 * O jeito que isso falha importa: coluna nova nasce SEM permissão de escrita e
 * a tela dá erro na primeira tentativa. É chato e é o lado certo de errar —
 * o contrário seria uma coluna sensível ficando aberta em silêncio.
 *
 * A lista abaixo é EXATAMENTE o que `updateProfile` envia, conferido contra o
 * código do aplicativo, e nada além disso:
 *
 *   - `public_key` e `friend_code` saem porque quem escreve neles é
 *     `set_public_key` e `regenerate_friend_code`, as duas SECURITY DEFINER e
 *     de dono `postgres` — continuam funcionando sem a permissão direta. Com a
 *     permissão direta, por outro lado, dava para trocar a chave pública de
 *     ponta a ponta por uma nossa e ler conversa alheia.
 *   - `id` e `created_at` saem porque identidade e idade da conta não são campo
 *     de formulário. `created_at` alimenta o emblema de veterano; solto, o
 *     emblema viraria enfeite comprável com uma chamada de API.
 *
 * `anon` também perde o UPDATE, e não ganha nada de volta: visitante sem conta
 * não tem perfil para editar. A política de RLS já barrava, mas privilégio e
 * política são duas trancas diferentes, e a mais barata das duas estava aberta.
 */
revoke update on public.profiles from anon, authenticated;
grant update (
  display_name, avatar_url, banner_url, bio, pronouns, headline,
  profile_theme, status_text, status_emoji, status_until,
  updated_at
) on public.profiles to authenticated;

-- ------------------------------------------------------------- 2. AS REGRAS

create table if not exists public.affiliate_terms (
  id                 text primary key,
  -- Da primeira mensalidade de quem foi indicado.
  primeira_pct       numeric(4, 3) not null check (primeira_pct between 0 and 1),
  -- De cada renovação depois disso, para sempre enquanto a assinatura durar.
  recorrente_pct     numeric(4, 3) not null check (recorrente_pct between 0 and 1),
  -- Prazo, em dias de vida da conta, para ela ainda poder dizer quem indicou.
  janela_dias        int not null check (janela_dias > 0),
  -- Mínimo para resgatar em crédito.
  minimo_resgate_cents int not null check (minimo_resgate_cents > 0)
);

/**
 * 30% da primeira, 10% das seguintes.
 *
 * O Pro custa R$ 9,90. A loja leva 15%, sobram R$ 8,42. Pagando 30% do preço
 * cheio (R$ 2,97) na primeira, ainda ficam R$ 5,45 — e o custo de servir um
 * assinante Pro (IA e transcrição dentro da cota) está bem abaixo disso. Na
 * renovação a comissão cai para 10% (R$ 0,99) e a margem volta ao normal.
 *
 * Pagar mais na primeira é de propósito: é o esforço de convencer alguém que
 * merece ser pago, não o de existir depois.
 *
 * A janela de 7 dias evita o caso feio: alguém usa o app há um ano, decide
 * assinar, e aí um afiliado aparece pedindo para "colocar o código" para
 * faturar em cima de uma venda que já estava feita.
 */
insert into public.affiliate_terms (id, primeira_pct, recorrente_pct, janela_dias, minimo_resgate_cents)
values ('padrao', 0.300, 0.100, 7, 500)
on conflict (id) do update
  set primeira_pct = excluded.primeira_pct,
      recorrente_pct = excluded.recorrente_pct,
      janela_dias = excluded.janela_dias,
      minimo_resgate_cents = excluded.minimo_resgate_cents;

alter table public.affiliate_terms enable row level security;
drop policy if exists "todo mundo lê as regras" on public.affiliate_terms;
create policy "todo mundo lê as regras" on public.affiliate_terms
  for select to authenticated using (true);

-- ---------------------------------------------------------- 3. AS COMISSÕES

create table if not exists public.affiliate_commissions (
  id           bigserial primary key,
  referrer_id  uuid not null references public.profiles(id) on delete cascade,
  buyer_id     uuid not null references public.profiles(id) on delete cascade,
  kind         text not null check (kind in ('primeira', 'recorrente')),
  -- O que a pessoa indicada pagou, em centavos.
  base_cents   int  not null check (base_cents > 0),
  rate         numeric(4, 3) not null,
  amount_cents int  not null check (amount_cents > 0),
  -- Id da compra na loja. Lojas reenviam confirmação; o único aqui é o que
  -- impede a mesma venda de virar duas comissões.
  ref          text not null unique,
  resgatado_em timestamptz,
  created_at   timestamptz not null default now(),
  -- Indicar a si mesmo com uma segunda conta não seria fraude cara (a pessoa
  -- pagou de verdade e leva 30% de volta, o que é um desconto), mas o banco
  -- recusa de todo jeito: mantém o relatório honesto.
  constraint nao_indica_a_si_mesmo check (referrer_id <> buyer_id)
);

create index if not exists idx_commissions_referrer
  on public.affiliate_commissions (referrer_id, created_at desc);

alter table public.affiliate_commissions enable row level security;

-- Só leitura, e só do que é seu. Nenhuma política de INSERT, UPDATE ou DELETE:
-- essa tabela é escrita exclusivamente pelas funções SECURITY DEFINER abaixo.
drop policy if exists "vê as próprias comissões" on public.affiliate_commissions;
create policy "vê as próprias comissões" on public.affiliate_commissions
  for select to authenticated using (referrer_id = auth.uid());

-- ------------------------------------------------------------ 4. ATRIBUIÇÃO

/**
 * "Fui indicado por este código."
 *
 * Só funciona uma vez, só numa conta nova, e nunca aponta para si mesmo. É a
 * única parte do programa que o aplicativo pode disparar — e ela não move
 * dinheiro nenhum, só grava de quem é o crédito quando (e se) uma compra
 * acontecer.
 */
create or replace function public.set_referrer(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me       uuid := auth.uid();
  v_code     text := lower(regexp_replace(coalesce(p_code, ''), '[^0-9A-Za-z]', '', 'g'));
  v_referrer uuid;
  v_nome     text;
  v_janela   int;
  v_ja       boolean;
  v_idade    interval;
begin
  if v_me is null then
    raise exception 'Você precisa estar logado.';
  end if;

  select janela_dias into v_janela from public.affiliate_terms where id = 'padrao';

  select referred_by is not null, now() - created_at
    into v_ja, v_idade
  from public.profiles where id = v_me;

  if v_ja then
    raise exception 'AFILIADO:ja_indicado';
  end if;
  if v_idade > make_interval(days => v_janela) then
    raise exception 'AFILIADO:tarde_demais';
  end if;

  select id, display_name into v_referrer, v_nome
  from public.profiles where affiliate_code = v_code;

  if v_referrer is null then
    raise exception 'AFILIADO:codigo_invalido';
  end if;
  if v_referrer = v_me then
    raise exception 'AFILIADO:voce_mesmo';
  end if;

  update public.profiles
  set referred_by = v_referrer, referred_at = now()
  where id = v_me;

  return jsonb_build_object('nome', v_nome);
end;
$$;

revoke all on function public.set_referrer(text) from public, anon;
grant execute on function public.set_referrer(text) to authenticated;

-- --------------------------------------------------------------- 5. A VENDA

/**
 * Chamada pelo servidor depois que a loja confirma a compra. NUNCA pelo app.
 *
 * `p_ref` é o id da compra na loja, e é único na tabela: a loja reenviar a
 * confirmação — e o Google Play reenvia — não gera comissão dobrada.
 */
create or replace function public.record_pro_purchase(
  p_buyer uuid, p_base_cents int, p_ref text, p_kind text default 'primeira'
) returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_referrer uuid;
  v_rate     numeric(4, 3);
  v_amount   int;
  v_id       bigint;
begin
  if p_kind not in ('primeira', 'recorrente') then
    raise exception 'Tipo de comissão desconhecido: %', p_kind;
  end if;
  if p_base_cents <= 0 then
    raise exception 'Valor inválido.';
  end if;

  select referred_by into v_referrer from public.profiles where id = p_buyer;
  if v_referrer is null or v_referrer = p_buyer then
    return null;
  end if;

  select case when p_kind = 'primeira' then primeira_pct else recorrente_pct end
    into v_rate from public.affiliate_terms where id = 'padrao';

  v_amount := floor(p_base_cents * v_rate)::int;
  -- Comissão que arredonda para zero não vira linha: extrato cheio de R$ 0,00
  -- só faz a pessoa achar que o programa não paga.
  if v_amount <= 0 then
    return null;
  end if;

  insert into public.affiliate_commissions
    (referrer_id, buyer_id, kind, base_cents, rate, amount_cents, ref)
  values (v_referrer, p_buyer, p_kind, p_base_cents, v_rate, v_amount, p_ref)
  on conflict (ref) do nothing
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_pro_purchase(uuid, int, text, text)
  from public, anon, authenticated;

-- ------------------------------------------------------------- 6. O RESGATE

/**
 * Quantos créditos vale um centavo de comissão.
 *
 * Vale o preço do MELHOR pacote da loja — ou seja, resgatar rende pelo menos
 * tanto quanto comprar com o mesmo dinheiro. Pagar menos do que a loja cobra
 * transformaria a comissão numa pegadinha, e a pessoa faria a conta.
 *
 * E sai mais barato para nós do que pagar em dinheiro: o crédito custa o preço
 * da API, que está bem abaixo do preço de venda.
 */
create or replace function public.creditos_por_centavo()
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(max(credits::numeric / price_cents), 0)
  from public.credit_packs where active;
$$;

/**
 * Transforma comissão reconhecida em crédito de IA.
 *
 * Pode ser chamada pelo app: ela não cria dinheiro, só troca de forma um valor
 * que o servidor já tinha registrado.
 *
 * A ordem é de propósito. Marcar PRIMEIRO e conferir o mínimo DEPOIS parece
 * errado, mas é o que fecha a corrida de dois toques no botão: o UPDATE tranca
 * as linhas, a segunda chamada fica esperando, e quando ela enfim roda já não
 * encontra nada em aberto — soma zero e cai no mínimo. Somar antes de trancar
 * deixaria as duas verem o mesmo saldo e resgatarem em dobro.
 *
 * Cair no `raise` desfaz o UPDATE junto, porque a exceção derruba a transação
 * inteira. Nada fica marcado como resgatado sem o crédito ter entrado.
 */
create or replace function public.resgatar_comissao()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me      uuid := auth.uid();
  v_cents   int;
  v_ultima  bigint;
  v_minimo  int;
  v_credits int;
begin
  if v_me is null then
    raise exception 'Você precisa estar logado.';
  end if;

  select minimo_resgate_cents into v_minimo from public.affiliate_terms where id = 'padrao';

  with pego as (
    update public.affiliate_commissions
    set resgatado_em = now()
    where referrer_id = v_me and resgatado_em is null
    returning id, amount_cents
  )
  select coalesce(sum(amount_cents), 0)::int, coalesce(max(id), 0) into v_cents, v_ultima from pego;

  if v_cents < v_minimo then
    raise exception 'AFILIADO:abaixo_do_minimo:%', v_minimo;
  end if;

  v_credits := floor(v_cents * public.creditos_por_centavo())::int;
  if v_credits <= 0 then
    raise exception 'AFILIADO:abaixo_do_minimo:%', v_minimo;
  end if;

  -- grant_credits é revogada de `authenticated`, mas esta função roda como a
  -- dona dela — é por isso que o resgate funciona sem abrir a torneira de
  -- crédito para o aplicativo.
  --
  -- A referência é o id da última comissão resgatada, e não o relógio: dois
  -- resgates no mesmo segundo teriam o mesmo carimbo de tempo, e grant_credits
  -- trata `ref` repetido como reenvio da loja — o segundo não creditaria nada.
  perform public.grant_credits(
    v_me, v_credits, 'afiliado', 'afiliado-' || v_ultima::text
  );

  return jsonb_build_object('centavos', v_cents, 'creditos', v_credits);
end;
$$;

revoke all on function public.resgatar_comissao() from public, anon;
grant execute on function public.resgatar_comissao() to authenticated;

-- --------------------------------------------------------------- 7. A TELA

/**
 * Tudo o que a tela de afiliados precisa, numa chamada só.
 *
 * `indicados` conta quem colou o código; `assinantes` conta quem virou dinheiro.
 * Mostrar os dois separados é o que evita a impressão de que o programa não
 * paga: dez indicados e zero assinantes é uma informação útil, e um número só
 * esconderia isso.
 */
create or replace function public.meu_afiliado()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'codigo',        (select affiliate_code from public.profiles where id = auth.uid()),
    'indicados',     (select count(*) from public.profiles where referred_by = auth.uid()),
    'assinantes',    (select count(distinct buyer_id) from public.affiliate_commissions
                        where referrer_id = auth.uid()),
    'total_cents',   (select coalesce(sum(amount_cents), 0)::int from public.affiliate_commissions
                        where referrer_id = auth.uid()),
    'aberto_cents',  (select coalesce(sum(amount_cents), 0)::int from public.affiliate_commissions
                        where referrer_id = auth.uid() and resgatado_em is null),
    'minimo_cents',  (select minimo_resgate_cents from public.affiliate_terms where id = 'padrao'),
    'primeira_pct',  (select primeira_pct from public.affiliate_terms where id = 'padrao'),
    'recorrente_pct',(select recorrente_pct from public.affiliate_terms where id = 'padrao'),
    'janela_dias',   (select janela_dias from public.affiliate_terms where id = 'padrao'),
    'fui_indicado',  (select referred_by is not null from public.profiles where id = auth.uid()),
    'por_credito',   public.creditos_por_centavo()
  );
$$;

revoke all on function public.meu_afiliado() from public, anon;

-- Conta interna do resgate. O aplicativo nunca chama: quem precisa do número é
-- `meu_afiliado`, que já devolve pronto, e `resgatar_comissao`, que roda como a
-- dona e por isso não depende de concessão nenhuma. Aberta, ela não vazava
-- segredo — preço de pacote está na loja —, mas superfície que ninguém usa é
-- superfície que ninguém confere.
revoke all on function public.creditos_por_centavo() from public, anon, authenticated;
grant execute on function public.meu_afiliado() to authenticated;
