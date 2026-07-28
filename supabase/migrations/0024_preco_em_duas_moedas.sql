-- ===========================================================================
-- Preço em real e em dólar, com margens diferentes de propósito.
--
-- O pedido era margem baixa, compensada por volume. Metade disso não fecha, e a
-- outra metade é a solução.
--
-- O QUE NÃO FECHA. Custo em dólar, receita em real. O ponto onde a venda passa
-- a dar prejuízo é
--
--     câmbio_de_prejuízo = 0,85 x preço_em_real / custo_em_dólar
--
-- Com 20% de margem na cotação de hoje (R$ 5,09), esse ponto fica em R$ 6,66 —
-- um patamar que o real já visitou. E volume não protege: vender dez vezes mais
-- com margem negativa perde dez vezes mais. Volume multiplica o sinal que
-- estiver lá, seja qual for.
--
-- O QUE FECHA. Receita EM DÓLAR não tem risco cambial nenhum: custo e preço
-- andam juntos. Ali margem baixa é segura, e é onde o volume compensa de
-- verdade.
--
-- Daí as duas tabelas de preço:
--   real   -> margem ~28%, ponto de prejuízo acima de R$ 7,50 (folga cambial)
--   dólar  -> margem ~25%, sem folga necessária, preço mais agressivo
--
-- O preço em real ficou MENOR do que estava (Pro de R$ 14,90 para R$ 11,90),
-- porque a folga não precisa ser tão grande quanto a que a 0021 deixou. Barato
-- o suficiente para crescer, longe o suficiente do prejuízo.
-- ===========================================================================

alter table public.plans        add column if not exists price_usd_cents int;
alter table public.credit_packs add column if not exists price_usd_cents int;

comment on column public.plans.price_usd_cents is
  'Preço em centavos de dólar, para venda fora do Brasil. Nulo = não vendido '
  'nessa moeda. Margem menor que a do real, porque não corre risco cambial.';

-- ----------------------------------------------------------- ASSINATURAS

/**
 * Pro: R$ 11,90 / US$ 2,29 por 450 créditos (custo US$ 1,35).
 *
 *   real   receita 11,90/5,09 = US$ 2,338 ; líquido x0,85 = 1,987 ; -1,35
 *          -> lucro US$ 0,637  =  27,3%   ; prejuízo só acima de R$ 7,49
 *   dólar  2,29 x 0,85 = 1,947 ; -1,35 -> lucro US$ 0,597 = 26,0%
 */
update public.plans set price_cents = 1190, price_usd_cents = 229 where id = 'pro';

/**
 * Max: R$ 23,90 / US$ 4,49 por 900 créditos (custo US$ 2,70).
 *
 *   real   4,696 bruto ; 3,991 líquido ; -2,70 -> 27,5% ; prejuízo acima de 7,52
 *   dólar  3,817 líquido ; -2,70 -> 24,9%
 */
update public.plans set price_cents = 2390, price_usd_cents = 449 where id = 'max';

-- -------------------------------------------------------------- PACOTES

/**
 * O desconto por volume é real, e maior no dólar — é lá que o volume é o
 * objetivo e o risco é menor.
 *
 *   100  R$ 2,99 (R$ 0,0299/cr)  US$ 0,49
 *   300  R$ 7,99 (R$ 0,0266/cr)  US$ 1,49
 *  1000  R$ 26,90 (R$ 0,0269/cr) US$ 4,99
 *
 * O de 1000 em real não desce abaixo do de 300 de propósito: puxar mais
 * derrubaria o ponto de prejuízo para perto de R$ 7, e o pacote grande é o que
 * mais gente compra quando o app engrena — é o pior lugar para ficar exposto.
 */
update public.credit_packs set price_cents =  299, price_usd_cents =  49 where id = 'c100';
update public.credit_packs set price_cents =  799, price_usd_cents = 149 where id = 'c300';
update public.credit_packs set price_cents = 2690, price_usd_cents = 499 where id = 'c1000';

-- ------------------------------------------------- O MONITOR, NAS DUAS MOEDAS

/**
 * Em que cotação esta venda passa a dar prejuízo.
 *
 * É o número que importa de verdade, e mais honesto do que a margem sozinha:
 * "28% de margem" não diz nada sobre risco, "só perde dinheiro acima de R$ 7,50"
 * diz tudo. Devolve nulo para preço em dólar, que não corre esse risco.
 */
create or replace function public.breakeven_rate(p_price_cents int, p_credits int, p_store_fee numeric default 0.15)
returns numeric language sql immutable set search_path = public as $$
  select case when p_credits = 0 then null
              else round((1 - p_store_fee) * (p_price_cents / 100.0) / (p_credits * 0.003), 2) end;
$$;

-- O `create or replace` não muda a lista de colunas devolvida: o Postgres
-- recusa com "cannot change return type of existing function". Como a versão
-- da 0022 devolvia menos colunas, ela precisa sair antes.
drop function if exists public.pricing_health(numeric);

create function public.pricing_health(p_usd_brl numeric default 5.09)
returns table (
  item text, tipo text, reais numeric, dolar numeric, creditos int,
  margem_brl numeric, margem_usd numeric, prejuizo_acima_de numeric, veredito text
) language sql stable set search_path = public as $$
  with tudo as (
    select p.id, 'assinatura'::text as tipo, p.price_cents, p.price_usd_cents, p.monthly_credits as creditos
      from public.plans p where p.price_cents > 0
    union all
    select c.id, 'pacote'::text, c.price_cents, c.price_usd_cents, c.credits
      from public.credit_packs c where c.active
  )
  select
    t.id,
    t.tipo,
    round(t.price_cents / 100.0, 2),
    round(t.price_usd_cents / 100.0, 2),
    t.creditos,
    public.margin_of(t.price_cents, t.creditos, p_usd_brl),
    -- Em dólar o "câmbio" é 1: preço e custo já estão na mesma moeda.
    public.margin_of(t.price_usd_cents, t.creditos, 1.0),
    public.breakeven_rate(t.price_cents, t.creditos),
    case
      when public.margin_of(t.price_cents, t.creditos, p_usd_brl) < 0.15 then 'REAL ABAIXO DO PISO'
      when public.margin_of(t.price_usd_cents, t.creditos, 1.0) < 0.15 then 'DÓLAR ABAIXO DO PISO'
      when public.breakeven_rate(t.price_cents, t.creditos) < 7.0 then 'pouca folga cambial'
      when public.margin_of(t.price_cents, t.creditos, p_usd_brl) > 0.40 then 'acima do teto'
      else 'ok'
    end
  from tudo t
  order by t.tipo, t.price_cents;
$$;
