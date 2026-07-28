-- ===========================================================================
-- Quais modelos de IA o plano da pessoa alcança.
--
-- A ordem dos planos sai do PREÇO, e não de uma lista escrita à mão. Uma lista
-- teria de ser editada toda vez que um nível novo aparecesse — e foi assim que
-- o 'max' quase entrou sem ninguém lembrar de encaixá-lo na hierarquia.
-- Comparar preço é automático: quem paga mais alcança tudo o que quem paga
-- menos alcança.
-- ===========================================================================

/**
 * O que este plano custa. Serve como posição na escada.
 */
create or replace function public.plan_rank(p_plan text)
returns int language sql stable set search_path = public as $$
  select coalesce((select price_cents from public.plans where id = p_plan), 0);
$$;

/**
 * Os modelos liberados para quem está chamando, do mais barato ao mais caro.
 *
 * A ORDEM IMPORTA: a função de borda usa o primeiro da lista quando o app não
 * pede nenhum, ou pede um que não existe. O primeiro ser o mais barato é o que
 * garante que um pedido malformado saia barato, e não caro.
 *
 * SECURITY DEFINER para poder comparar preços de plano, que não são visíveis a
 * quem usa o app — e não precisam ser: a tela mostra "Rápido" e "Máximo", não
 * o preço interno de cada nível.
 */
create or replace function public.my_ai_models()
returns table (id text, label text, min_plan text)
language sql stable security definer set search_path = public as $$
  select m.id, m.label, m.min_plan
    from public.ai_models m
   where m.active
     and (
       m.min_plan is null
       or public.plan_rank(public.current_plan(auth.uid())) >= public.plan_rank(m.min_plan)
     )
   order by m.position;
$$;

revoke all on function public.my_ai_models() from public, anon;
grant execute on function public.my_ai_models() to authenticated;
