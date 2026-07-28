-- ===========================================================================
-- O preço por minuto da transcrição sai do banco, não do código.
--
-- A função de borda estava deduzindo o preço do NOME do modelo — se contém
-- "mini", US$ 0,003; senão, US$ 0,006. Funciona hoje e falha calado amanhã: no
-- dia em que a OpenAI lançar um modelo com outro nome e outro preço, ou mudar o
-- valor de um existente, o débito continua usando o número velho e ninguém
-- percebe até a fatura.
--
-- O mesmo motivo pelo qual os preços de token dos modelos de texto já moram na
-- `ai_models`: preço é dado, muda sozinho, e precisa mudar por UPDATE — sem
-- migração, sem republicar função de borda, sem recompilar aplicativo.
-- ===========================================================================

alter table public.plans
  add column if not exists transcribe_usd_min numeric(8, 5);

comment on column public.plans.transcribe_usd_min is
  'Quanto custa, em dólar, um minuto no modelo de transcrição deste plano. '
  'Lido pela função de borda para debitar crédito.';

update public.plans set transcribe_usd_min = 0.003 where transcribe_model = 'gpt-4o-mini-transcribe';
update public.plans set transcribe_usd_min = 0.006 where transcribe_model = 'gpt-4o-transcribe';

-- Sem preço não dá para debitar, e debitar errado é pior do que não transcrever.
alter table public.plans
  alter column transcribe_usd_min set not null;

/**
 * Agora devolve também o preço do minuto e o saldo, para a função de borda
 * resolver tudo numa consulta só.
 *
 * O `create or replace` não muda a lista de colunas de uma função — o Postgres
 * recusa com "cannot change return type of existing function" —, então a versão
 * anterior precisa sair antes.
 */
drop function if exists public.my_transcribe_config();

create function public.my_transcribe_config()
returns table (plan text, model text, usd_min numeric, saldo int)
language sql stable security definer set search_path = public as $$
  select
    p.id,
    p.transcribe_model,
    p.transcribe_usd_min,
    public.credit_balance(auth.uid())
  from public.plans p
  where p.id = public.current_plan(auth.uid());
$$;

revoke all on function public.my_transcribe_config() from public, anon;
grant execute on function public.my_transcribe_config() to authenticated;
