-- ===========================================================================
-- Preços que fecham a conta, com folga cambial.
--
-- A 0020 deixou os pacotes acima de 30% na cotação de projeto (R$ 6,00), mas o
-- de 1000 caía para 29,1% num dólar a 6,50 — e um pacote grande é justamente o
-- que mais gente compra quando o app engrena. Corrigido aqui.
--
-- E o Pro estava dando PREJUÍZO no uso pleno, o que a conta de crédito deixou
-- evidente:
--
--   R$ 9,90 / 6,00                       = US$ 1,650
--   Google Play leva 15%                 = US$ 1,403 líquido
--   300 min x US$ 0,006 (gpt-4o-transcribe) = US$ 1,800 de custo
--   ------------------------------------------------------------
--   prejuízo de US$ 0,40 por assinante que usasse o que comprou
--
-- O conserto não é só subir o preço: é subir um pouco E trazer o incluído para
-- um tamanho que caiba, com crédito avulso para quem passa disso. Assinatura
-- que dá prejuízo em quem mais usa pune o sucesso do produto.
-- ===========================================================================

-- ------------------------------------------------- 1. PACOTE GRANDE AJUSTADO

/**
 * R$ 34,90 -> R$ 36,90.
 *
 * Dois reais que compram tranquilidade cambial: a 6,50 a margem sai de 29,1%
 * para 32,1%, e na cotação de hoje (5,09) segue em 43,6%. O desconto por volume
 * continua existindo — sai mais barato por crédito do que o pacote de 100 —,
 * só deixou de existir às custas da margem.
 */
update public.credit_packs set price_cents = 3690 where id = 'c1000';

-- ----------------------------------------------------- 2. ASSINATURA REFEITA

/**
 * R$ 9,90 -> R$ 14,90, com o incluído redimensionado.
 *
 * Os 300 minutos vieram de antes de existir custo por minuto atrelado. 120
 * minutos são duas aulas inteiras por mês, que é o uso real de quem estuda —
 * e quem precisa de mais compra crédito, onde a margem é conhecida.
 *
 * Conferência no uso PLENO, que é o caso ruim:
 *   receita   R$ 14,90 / 6,00              = US$ 2,483
 *   Google Play leva 15%                   = US$ 2,111 líquido
 *   120 min x US$ 0,006                    = US$ 0,720
 *   150 pedidos de IA x ~US$ 0,0021        = US$ 0,315
 *   ----------------------------------------------------
 *   lucro                                    US$ 1,076  ->  43% da receita
 *
 * A 7,00 ainda dá 36%. O plano só perde dinheiro se o custo por minuto da
 * OpenAI dobrar — e nesse dia o conserto é um UPDATE aqui.
 */
update public.plans set
  price_cents          = 1490,
  transcribe_min_month = 120,
  ai_calls_per_month   = 150
where id = 'pro';

/**
 * O grátis também encolheu: 15 -> 10 minutos, 20 pedidos mantidos.
 *
 * Custo por pessoa que talvez nunca pague: 10 x US$ 0,003 + 20 x ~US$ 0,0007 =
 * US$ 0,044. É custo de aquisição, e a esse tamanho continua barato mesmo com
 * milhares de contas. Dez minutos gravam uma aula curta inteira, que é o
 * bastante para a pessoa ver o valor e decidir.
 */
update public.plans set
  transcribe_min_month = 10
where id = 'free';

-- --------------------------------------------- 3. A MARGEM VIRA CONFERÊNCIA

/**
 * Margem da assinatura no uso pleno.
 *
 * Existe pelo mesmo motivo da `pack_margin`: número prometido em comentário
 * envelhece calado. Assim dá para perguntar ao banco, e o teste pergunta.
 *
 * O custo por pedido de IA entra como parâmetro porque depende do modelo em
 * uso, que muda com mais frequência do que o preço do plano.
 */
create or replace function public.plan_margin(
  p_plan text,
  p_usd_brl numeric default 6.0,
  p_store_fee numeric default 0.15,
  p_ai_call_usd numeric default 0.0021
) returns numeric language sql stable set search_path = public as $$
  select case when p.price_cents = 0 then null else round(
    ((p.price_cents / 100.0 / p_usd_brl) * (1 - p_store_fee)
      - p.transcribe_min_month * (
          case p.transcribe_model
            when 'gpt-4o-transcribe' then 0.006
            when 'gpt-4o-mini-transcribe' then 0.003
            else 0.006
          end)
      - p.ai_calls_per_month * p_ai_call_usd)
    / (p.price_cents / 100.0 / p_usd_brl),
    4) end
  from public.plans p where p.id = p_plan;
$$;

comment on function public.plan_margin(text, numeric, numeric, numeric) is
  'Margem da assinatura se a pessoa usar TODO o incluído. Devolve nulo para '
  'plano gratuito, que não tem receita para dividir.';
