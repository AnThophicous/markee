-- ===========================================================================
-- Um pool só de créditos, débito pelo custo real de tokens.
--
-- Texto e áudio saem do MESMO saldo. Dois contadores separados obrigam a
-- adivinhar a divisão por pessoa — quem só transcreve fica com metade parada, e
-- quem só usa texto reclama do contador de minutos que nunca desce.
--
-- QUEM PAGA O QUÊ:
--   - transcrição: sempre nossa chave da OpenAI  -> sempre debita
--   - IA de texto com a NOSSA chave              -> debita pelo token gasto
--   - IA de texto com a chave da própria pessoa  -> NÃO DEBITA NADA
--
-- O último caso é o que já existia e continua: se os tokens saem do bolso dela,
-- cobrar crédito seria cobrar para limitar uma conta que ela já paga. Não custa
-- nada nosso, não há o que cobrar.
--
-- A MARGEM É CONFERÍVEL, NÃO PROMETIDA. O alvo é 30%, o piso é 15% e o teto é
-- 40%: abaixo do piso o produto se paga mal, acima do teto está caro demais
-- para o que entrega. As funções no fim medem, e o teste pergunta.
-- ===========================================================================

-- ------------------------------------------- 0. OS PLANOS, ANTES DOS MODELOS
--
-- Vem primeiro porque `ai_models.min_plan` aponta para `plans`: criar o modelo
-- que exige o plano 'max' antes de o plano existir quebra a chave estrangeira.

alter table public.plans
  add column if not exists monthly_credits int not null default 0;

comment on column public.plans.monthly_credits is
  'Créditos que entram todo mês pela assinatura. Somam com os comprados; a '
  'diferença é que estes não acumulam de um mês para o outro.';

/**
 * O nível de R$ 29,90.
 *
 * Quem paga aqui leva crédito para texto E áudio no mesmo saldo, que é o pedido
 * de quem usa o app para valer: gravar a aula, transcrever e ainda pedir resumo
 * em cima, sem escolher entre uma coisa e outra.
 *
 * A conta, na cotação de projeto (R$ 6,00) e com o Google Play levando 15%:
 *   receita  R$ 29,90 / 6,00        = US$ 4,983
 *   líquido  x 0,85                 = US$ 4,236
 *   custo    900 x US$ 0,003        = US$ 2,700
 *   lucro                             US$ 1,536  ->  30,8% da receita
 */
insert into public.plans (id, name, price_cents, ai_calls_per_month, transcribe_min_month, transcribe_model, monthly_credits)
values ('max', 'Markee Max', 2990, 0, 0, 'gpt-4o-transcribe', 900)
on conflict (id) do update
  set name = excluded.name,
      price_cents = excluded.price_cents,
      transcribe_model = excluded.transcribe_model,
      monthly_credits = excluded.monthly_credits;


-- ------------------------------------------------ 1. PREÇO DE CADA MODELO

/**
 * Preço por milhão de tokens, como a OpenRouter cobra.
 *
 * Em tabela, e não em `case` dentro de função: preço de modelo muda sozinho,
 * e um UPDATE aqui vale na chamada seguinte — sem migração, sem republicar
 * função de borda, sem recompilar aplicativo.
 *
 * `min_plan` é o piso: `null` libera para todo mundo, 'pro' exige assinatura.
 * É a resposta para "melhorar os modelos disponíveis" sem entregar o modelo
 * caro para conta grátis.
 */
create table if not exists public.ai_models (
  id            text primary key,
  label         text not null,
  input_usd_m   numeric(10, 4) not null check (input_usd_m >= 0),
  output_usd_m  numeric(10, 4) not null check (output_usd_m >= 0),
  min_plan      text references public.plans(id),
  active        bool not null default true,
  position      int  not null default 0
);

alter table public.ai_models enable row level security;
drop policy if exists "todo mundo vê os modelos" on public.ai_models;
create policy "todo mundo vê os modelos" on public.ai_models
  for select to authenticated using (active);

/**
 * Preços conferidos na API da OpenRouter em 28/07/2026.
 *
 * A escada existe para a escolha ser real: o barato resolve resumo e correção,
 * o do meio raciocina melhor, e o caro só aparece para quem assina — não por
 * capricho, mas porque um pedido no Gemini Pro custa treze vezes um no 4o-mini,
 * e conta grátis não tem receita para cobrir isso.
 */
insert into public.ai_models (id, label, input_usd_m, output_usd_m, min_plan, position) values
  ('openai/gpt-4o-mini',         'Rápido',      0.15,  0.60,  null,  0),
  ('deepseek/deepseek-chat',     'Equilibrado', 0.20,  0.80,  null,  1),
  ('google/gemini-2.5-flash',    'Esperto',     0.30,  2.50,  null,  2),
  ('anthropic/claude-haiku-4.5', 'Preciso',     1.00,  5.00,  'pro', 3),
  ('google/gemini-2.5-pro',      'Máximo',      1.25, 10.00,  'max', 4)
on conflict (id) do update
  set label = excluded.label,
      input_usd_m = excluded.input_usd_m,
      output_usd_m = excluded.output_usd_m,
      min_plan = excluded.min_plan,
      position = excluded.position;

-- ------------------------------------------- 2. QUANTOS CRÉDITOS UMA CHAMADA

/**
 * O custo em dólar de uma chamada, pelos tokens que ela gastou de verdade.
 *
 * Tokens MEDIDOS, devolvidos pela OpenRouter na resposta — nunca estimados. Uma
 * estimativa erra para os dois lados: para menos vira prejuízo silencioso, para
 * mais cobra pelo que não aconteceu, e a pessoa não tem como conferir nenhum
 * dos dois.
 */
create or replace function public.ai_call_cost_usd(p_model text, p_in int, p_out int)
returns numeric language sql stable set search_path = public as $$
  select coalesce(
    (select (greatest(p_in, 0) * m.input_usd_m + greatest(p_out, 0) * m.output_usd_m) / 1000000.0
       from public.ai_models m where m.id = p_model),
    0);
$$;

/**
 * Quantos créditos aquela chamada consome.
 *
 * A margem NÃO entra aqui. Ela vive no preço do crédito: um crédito custa
 * US$ 0,003 de API e é vendido por mais do que isso. Se a margem também
 * entrasse no débito, ela seria cobrada duas vezes — uma na venda do crédito e
 * outra no consumo — e a conta real ficaria impossível de auditar.
 *
 * Assim, o débito responde só "quanto custou", e a `pack_margin` responde
 * "quanto ganhamos". Duas perguntas separadas, duas contas separadas.
 */
create or replace function public.credits_for_call(p_model text, p_in int, p_out int)
returns int language sql stable set search_path = public as $$
  select greatest(1, ceil(public.ai_call_cost_usd(p_model, p_in, p_out) / public.credit_unit_usd())::int);
$$;

-- --------------------------------------------- 3. O PLANO DÁ CRÉDITO POR MÊS

/**
 * Os créditos de cada plano saem da margem de 30%, não do palpite:
 *   créditos = (receita_líquida - 0,30 x receita_bruta) / US$ 0,003
 */
update public.plans set monthly_credits = 30  where id = 'free';  -- custo US$ 0,09
update public.plans set monthly_credits = 450 where id = 'pro';   -- 30,6% de margem

-- ------------------------------------------------------ 4. A FAIXA DE MARGEM

/**
 * A margem de uma receita mensal qualquer, dado o que ela dá de crédito.
 *
 * Serve para plano e para pacote, porque a pergunta é a mesma: entrou tanto,
 * saiu tanto de API, sobrou quanto por cento.
 */
create or replace function public.margin_of(
  p_price_cents int, p_credits int, p_usd_brl numeric default 6.0, p_store_fee numeric default 0.15
) returns numeric language sql immutable set search_path = public as $$
  select case when p_price_cents = 0 then null else round(
    ((p_price_cents / 100.0 / p_usd_brl) * (1 - p_store_fee) - p_credits * 0.003)
    / (p_price_cents / 100.0 / p_usd_brl), 4) end;
$$;

/**
 * Tudo o que é vendido, com a margem e o veredito.
 *
 * Alvo 30%, piso 15%, teto 40%. Abaixo do piso o produto se paga mal; acima do
 * teto está caro demais para o que entrega, e cobrar demais de estudante afasta
 * mais gente do que os pontos de margem trazem.
 *
 * Vira teste: qualquer coisa fora da faixa aparece numa consulta, em vez de
 * aparecer na fatura no fim do mês.
 */
create or replace function public.pricing_health(p_usd_brl numeric default 6.0)
returns table (item text, tipo text, reais numeric, creditos int, margem numeric, veredito text)
language sql stable set search_path = public as $$
  with tudo as (
    select p.id, 'assinatura'::text as tipo, p.price_cents, p.monthly_credits as creditos
      from public.plans p where p.price_cents > 0
    union all
    select c.id, 'pacote'::text, c.price_cents, c.credits
      from public.credit_packs c where c.active
  )
  select
    t.id,
    t.tipo,
    round(t.price_cents / 100.0, 2),
    t.creditos,
    public.margin_of(t.price_cents, t.creditos, p_usd_brl),
    case
      when public.margin_of(t.price_cents, t.creditos, p_usd_brl) < 0.15 then 'ABAIXO DO PISO'
      when public.margin_of(t.price_cents, t.creditos, p_usd_brl) > 0.40 then 'acima do teto'
      else 'ok'
    end
  from tudo t
  order by t.tipo, t.price_cents;
$$;
