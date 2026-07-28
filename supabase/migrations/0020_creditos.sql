-- ===========================================================================
-- Créditos avulsos, com margem garantida por construção.
--
-- A REGRA: 30% de lucro sobre o que a pessoa paga, depois da taxa da loja.
--
--   margem = (P x (1 - taxa) - custo) / P = 0,30
--   P = custo / (0,70 - taxa)
--
-- Com o Google Play levando 15% — e leva, porque vender bem digital dentro de
-- app Android obriga o faturamento da loja —, isso dá P = custo / 0,55, ou
-- 1,82 vez o custo de API. Sem contar a taxa, a conta daria 1,43 e a margem
-- real seria 18%, não 30%.
--
-- O CRÉDITO É UMA UNIDADE DE CUSTO, não de operação: 1 crédito = US$ 0,003 de
-- API. É o que garante a margem seja qual for o modelo. Se o crédito fosse "um
-- pedido de IA", um modelo caro consumiria três vezes mais dinheiro pelo mesmo
-- crédito, e a margem viraria loteria por modelo.
--
-- O débito é sempre pelo custo MEDIDO — duração que a OpenAI informa, tokens
-- que a OpenRouter informa —, nunca por estimativa. Estimativa erra para os
-- dois lados: para menos é prejuízo, para mais é cobrar pelo que não houve.
-- ===========================================================================

/** Quanto custa, em dólar de API, um crédito. Muda a economia inteira. */
create or replace function public.credit_unit_usd()
returns numeric language sql immutable set search_path = public as $$
  select 0.003::numeric;
$$;

comment on function public.credit_unit_usd() is
  'US$ de custo de API que cabem em 1 crédito. Aumentar aqui encarece tudo '
  'proporcionalmente sem tocar em preço de pacote.';

-- ------------------------------------------------------------ 1. O RAZÃO

/**
 * Livro-razão, e não uma coluna de saldo.
 *
 * Saldo em coluna não responde "por que caiu de 500 para 380 ontem". Aqui cada
 * linha diz quanto, quando e por quê, e o saldo é a soma — que é sempre
 * reconstruível. Numa coisa que envolve dinheiro de quem paga, poder auditar
 * vale mais do que a consulta ser barata.
 */
create table if not exists public.credit_ledger (
  id         bigserial primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  -- Positivo entra (compra, bônus, estorno), negativo sai (uso).
  delta      int  not null,
  motivo     text not null,
  -- Custo de API de verdade, em dólar, quando a linha é consumo. Serve para
  -- conferir depois se o crédito está cobrindo o custo mesmo.
  custo_usd  numeric(10, 6),
  ref        text,
  created_at timestamptz not null default now(),
  constraint delta_nao_zero check (delta <> 0)
);

create index if not exists idx_credit_ledger_user on public.credit_ledger (user_id, created_at desc);

alter table public.credit_ledger enable row level security;

-- Só leitura, e só do próprio extrato. Escrever é exclusividade das funções
-- SECURITY DEFINER abaixo: um INSERT liberado aqui seria crédito de graça.
drop policy if exists "vê o próprio extrato" on public.credit_ledger;
create policy "vê o próprio extrato" on public.credit_ledger
  for select to authenticated using (user_id = auth.uid());

create or replace function public.credit_balance(p_user uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(sum(delta), 0)::int from public.credit_ledger where user_id = p_user;
$$;

-- ------------------------------------------------------- 2. OS PACOTES

create table if not exists public.credit_packs (
  id          text primary key,
  name        text not null,
  credits     int  not null check (credits > 0),
  price_cents int  not null check (price_cents > 0),
  -- Taxa da loja onde este pacote é vendido, para a margem ser conferível.
  store_fee   numeric(4, 3) not null default 0.150,
  active      bool not null default true,
  position    int  not null default 0
);

alter table public.credit_packs enable row level security;
drop policy if exists "todo mundo vê os pacotes" on public.credit_packs;
create policy "todo mundo vê os pacotes" on public.credit_packs
  for select to authenticated using (active);

/**
 * Preços em real, custo em dólar.
 *
 * A conversão usa R$ 6,00 por dólar de propósito, e não a cotação do dia (5,09
 * em 28/07/2026). Receita em real e custo em dólar: se o real se desvalorizar,
 * o mesmo pacote passa a comprar menos dólar e a margem encolhe. Precificar
 * numa cotação pessimista é o que impede que uma variação cambial coma o lucro
 * sem ninguém perceber — e hoje sobra quase 18% de folga.
 *
 * Conferência do pacote de 100 (R$ 3,90):
 *   receita  R$ 3,90 / 6,00        = US$ 0,650
 *   Google Play leva 15%           = US$ 0,553 líquido
 *   custo    100 x US$ 0,003       = US$ 0,300
 *   lucro                            US$ 0,253  ->  39% da receita
 *
 * Os pacotes maiores dão desconto por volume e ainda ficam acima de 30%: é
 * assim que se empurra o pacote grande sem prometer margem que não existe.
 */
insert into public.credit_packs (id, name, credits, price_cents, position) values
  ('c100',  '100 créditos',  100,   390, 0),
  ('c300',  '300 créditos',  300,  1090, 1),
  ('c1000', '1000 créditos', 1000, 3490, 2)
on conflict (id) do update
  set name = excluded.name,
      credits = excluded.credits,
      price_cents = excluded.price_cents,
      position = excluded.position;

/**
 * A margem de cada pacote, calculada e não prometida.
 *
 * Existe para virar teste: qualquer pacote que caia abaixo de 30% aparece numa
 * consulta, em vez de aparecer na fatura no fim do mês.
 */
create or replace function public.pack_margin(p_pack text, p_usd_brl numeric default 6.0)
returns numeric language sql stable set search_path = public as $$
  select round(
    ((p.price_cents / 100.0 / p_usd_brl) * (1 - p.store_fee)
      - p.credits * public.credit_unit_usd())
    / (p.price_cents / 100.0 / p_usd_brl),
    4)
  from public.credit_packs p where p.id = p_pack;
$$;

-- ------------------------------------------------------- 3. O CONSUMO

/**
 * Debita crédito pelo custo de API medido.
 *
 * Devolve quantos créditos foram tirados. Levanta exceção quando não há saldo —
 * quem chama trata, e a mensagem carrega o prefixo NO_CREDITS para a função de
 * borda distinguir de um erro qualquer.
 *
 * A trava é na linha de perfil, e não na de assinatura como faz a
 * `consume_quota`: perfil todo mundo tem, e travar uma linha que pode não
 * existir não trava nada — dois pedidos ao mesmo tempo passariam ambos pelo
 * último crédito.
 */
create or replace function public.consume_credits(p_custo_usd numeric, p_motivo text, p_ref text default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_user  uuid := auth.uid();
  v_qtd   int;
  v_saldo int;
begin
  if v_user is null then
    raise exception 'Você precisa estar logado.';
  end if;
  if p_custo_usd is null or p_custo_usd <= 0 then
    raise exception 'Custo inválido.';
  end if;

  -- Sempre para cima: um custo de US$ 0,0001 ainda é dinheiro que saiu, e
  -- arredondar para baixo daria trabalho de graça repetido indefinidamente.
  v_qtd := greatest(1, ceil(p_custo_usd / public.credit_unit_usd())::int);

  perform 1 from public.profiles where id = v_user for update;

  v_saldo := public.credit_balance(v_user);
  if v_saldo < v_qtd then
    raise exception 'NO_CREDITS:%:%', v_saldo, v_qtd;
  end if;

  insert into public.credit_ledger (user_id, delta, motivo, custo_usd, ref)
  values (v_user, -v_qtd, p_motivo, p_custo_usd, p_ref);

  return v_qtd;
end;
$$;

/**
 * Crédito entra por aqui, e só pela chave de serviço.
 *
 * Sem `grant` para `authenticated` de propósito: quem confirma pagamento é o
 * servidor, depois de ouvir a loja. Se o aplicativo pudesse chamar isto, bastava
 * um APK modificado para se dar mil créditos — e seria a coisa mais óbvia de
 * tentar num app de código aberto.
 */
create or replace function public.grant_credits(
  p_user uuid, p_credits int, p_motivo text, p_ref text default null
) returns int language plpgsql security definer set search_path = public as $$
begin
  if p_credits <= 0 then
    raise exception 'Quantidade inválida.';
  end if;

  -- `ref` é o id da compra na loja. Único por motivo: se a loja reenviar a
  -- confirmação — e lojas reenviam —, a segunda tentativa não credita de novo.
  if p_ref is not null and exists (
    select 1 from public.credit_ledger where ref = p_ref and motivo = p_motivo
  ) then
    return public.credit_balance(p_user);
  end if;

  insert into public.credit_ledger (user_id, delta, motivo, ref)
  values (p_user, p_credits, p_motivo, p_ref);

  return public.credit_balance(p_user);
end;
$$;

revoke all on function public.consume_credits(numeric, text, text) from public, anon;
grant execute on function public.consume_credits(numeric, text, text) to authenticated;

revoke all on function public.grant_credits(uuid, int, text, text) from public, anon, authenticated;

/** Saldo e extrato para a tela. */
create or replace function public.my_credits()
returns table (saldo int, unidade_usd numeric)
language sql stable security definer set search_path = public as $$
  select public.credit_balance(auth.uid()), public.credit_unit_usd();
$$;

revoke all on function public.my_credits() from public, anon;
grant execute on function public.my_credits() to authenticated;
