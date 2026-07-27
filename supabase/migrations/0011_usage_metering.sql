-- Medir o uso de IA sem bloquear quem usa a própria chave.
--
-- consume_quota debita E barra ao estourar o limite. Isso é o certo quando a
-- chamada sai da NOSSA chave, porque aí o custo é nosso. Só que hoje a chave da
-- OpenRouter é a do próprio usuário: barrar em 20 pedidos por mês não economiza
-- nada e só atrapalha.
--
-- record_usage grava o consumo sem barrar. Com isso o contador do plano ("IA:
-- 7 de 20") passa a dizer a verdade desde já, e o bloqueio entra sozinho no dia
-- em que a chamada passar pelo nosso servidor — aí o app volta a chamar
-- consume_quota.

create or replace function public.record_usage(p_kind text, p_amount int default 1)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Você precisa estar logado.';
  end if;
  if p_amount <= 0 then
    raise exception 'Quantidade inválida.';
  end if;
  if p_kind not in ('ai_call', 'transcribe_minute') then
    raise exception 'Tipo de uso desconhecido: %', p_kind;
  end if;

  insert into public.usage_events (user_id, kind, amount)
  values (v_user, p_kind, p_amount);

  return public.usage_this_month(v_user, p_kind);
end;
$$;

revoke all on function public.record_usage(text, int) from public, anon;
grant execute on function public.record_usage(text, int) to authenticated;
