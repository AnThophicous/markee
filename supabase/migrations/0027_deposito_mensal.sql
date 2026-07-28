-- ===========================================================================
-- Os créditos do plano entram sozinhos, uma vez por mês.
--
-- Sem isto a economia inteira ficava parada: `plans.monthly_credits` dizia 450,
-- o razão não tinha uma linha sequer, e todo mundo aparecia com saldo zero.
--
-- É PREGUIÇOSO, e não agendado. Uma tarefa periódica precisaria rodar para
-- todas as contas todo dia primeiro, falharia calada quando não rodasse, e
-- gastaria trabalho com contas que não abrem o app há meses. Aqui o depósito
-- acontece na primeira vez que a pessoa pergunta o saldo — que é exatamente
-- quando ela precisa dele.
--
-- A garantia de não duplicar é a `ref`: 'mensal:<plano>:<ano-mês>' é única por
-- conta e por mês. Chamar dez vezes no mesmo mês deposita uma vez só; o mês
-- seguinte tem outra `ref` e deposita de novo.
-- ===========================================================================

/**
 * Índice que faz a duplicata ser impossível, e não apenas improvável.
 *
 * A conferência em SQL antes do INSERT resolve o caso comum, mas duas chamadas
 * simultâneas — o app abrindo duas telas que perguntam o saldo ao mesmo tempo —
 * passariam ambas pela conferência antes de qualquer uma gravar. O índice único
 * é o que transforma isso em erro em vez de crédito dobrado.
 *
 * Parcial: só vale para as linhas com `ref`, porque consumo não tem referência
 * e são a maioria esmagadora do razão.
 */
create unique index if not exists idx_credit_ledger_ref_unico
  on public.credit_ledger (user_id, motivo, ref)
  where ref is not null;

/**
 * Deposita os créditos do mês, se ainda não foram depositados.
 *
 * Devolve o saldo depois do depósito. Não levanta exceção quando já depositou:
 * é o caso normal, acontece em toda chamada depois da primeira do mês.
 */
create or replace function public.claim_monthly_credits()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_user    uuid := auth.uid();
  v_plano   text;
  v_qtd     int;
  v_ref     text;
begin
  if v_user is null then
    raise exception 'Você precisa estar logado.';
  end if;

  v_plano := public.current_plan(v_user);
  select monthly_credits into v_qtd from public.plans where id = v_plano;

  if coalesce(v_qtd, 0) <= 0 then
    return public.credit_balance(v_user);
  end if;

  -- O plano entra na referência de propósito: quem assina no meio do mês
  -- recebe a diferença do plano novo na hora, em vez de esperar o mês virar
  -- para ver o que pagou. Trocar para um plano menor não devolve nada, que é
  -- o comportamento esperado de assinatura.
  v_ref := 'mensal:' || v_plano || ':' || to_char(now(), 'YYYY-MM');

  insert into public.credit_ledger (user_id, delta, motivo, ref)
  values (v_user, v_qtd, 'plano', v_ref)
  on conflict (user_id, motivo, ref) where ref is not null do nothing;

  return public.credit_balance(v_user);
end;
$$;

revoke all on function public.claim_monthly_credits() from public, anon;
grant execute on function public.claim_monthly_credits() to authenticated;

/**
 * Saldo, já com o depósito do mês feito.
 *
 * Deixou de ser STABLE porque agora escreve. É a única forma de o depósito
 * preguiçoso funcionar sem uma tarefa agendada — e o custo é um INSERT que não
 * faz nada, uma vez por chamada, contra uma tarefa que roda para todas as
 * contas do banco todo dia primeiro.
 */
drop function if exists public.my_credits();

create function public.my_credits()
returns table (saldo int, unidade_usd numeric, plano text, mensais int)
language sql volatile security definer set search_path = public as $$
  select
    public.claim_monthly_credits(),
    public.credit_unit_usd(),
    public.current_plan(auth.uid()),
    coalesce((select monthly_credits from public.plans where id = public.current_plan(auth.uid())), 0);
$$;

revoke all on function public.my_credits() from public, anon;
grant execute on function public.my_credits() to authenticated;
