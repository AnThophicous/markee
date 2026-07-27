-- Correção: regenerate_friend_code() quebrava com
-- "function gen_random_bytes(integer) does not exist".
--
-- No Supabase o pgcrypto fica no schema `extensions`, e a função foi declarada
-- com `search_path = public` — então a chamada não resolvia.
--
-- Os defaults das colunas (groups.join_code, profiles.friend_code) NÃO têm esse
-- problema: o Postgres guarda a expressão do default já parseada, com o OID da
-- função embutido, então ela é encontrada independente do search_path. Por isso
-- o cadastro e a criação de grupo sempre funcionaram — só a chamada em tempo de
-- execução falhava.

create or replace function public.regenerate_friend_code()
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  v_code text := encode(extensions.gen_random_bytes(4), 'hex');
begin
  if auth.uid() is null then
    raise exception 'Você precisa estar logado.';
  end if;
  update public.profiles set friend_code = v_code where id = auth.uid();
  return v_code;
end;
$$;

revoke all on function public.regenerate_friend_code() from public, anon;
grant execute on function public.regenerate_friend_code() to authenticated;
