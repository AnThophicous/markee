-- Corrige duas falhas no fluxo de entrar em grupo.
--
-- 1) VULNERABILIDADE (IDOR): a política de INSERT em group_members só exigia
--    `user_id = auth.uid()`. Qualquer usuário logado que descobrisse o UUID de
--    um grupo privado podia se inserir como membro — e a partir daí ver o grupo
--    e a lista de membros. Confirmado em teste.
--
-- 2) BUG: entrar por código nunca funcionou. O app buscava o grupo por
--    join_code, mas a política de SELECT esconde grupos de quem não é membro,
--    então a busca voltava sempre vazia.
--
-- Ambos somem ao mover a entrada para uma função SECURITY DEFINER: ela valida o
-- código no servidor (o cliente nunca precisa ler a tabela) e é o único caminho
-- para entrar num grupo privado.

create or replace function public.join_group(p_join_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_group_id uuid;
  v_role_id  uuid;
begin
  if auth.uid() is null then
    raise exception 'Você precisa estar logado.';
  end if;

  select id into v_group_id
    from public.groups
   where join_code = lower(btrim(p_join_code));

  if v_group_id is null then
    raise exception 'Nenhum grupo encontrado com esse código.';
  end if;

  select id into v_role_id
    from public.group_roles
   where group_id = v_group_id and is_default
   limit 1;

  insert into public.group_members (group_id, user_id, role_id)
  values (v_group_id, auth.uid(), v_role_id)
  on conflict (group_id, user_id) do nothing;

  return v_group_id;
end;
$$;

revoke all on function public.join_group(text) from public, anon;
grant execute on function public.join_group(text) to authenticated;

-- Entrada direta passa a valer só para grupos públicos. O gatilho que adiciona
-- o criador e a função acima são SECURITY DEFINER, então não são afetados.
drop policy if exists "entra no grupo por si mesmo" on public.group_members;

create policy "entra sozinho apenas em grupo publico" on public.group_members
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.groups g where g.id = group_id and g.is_public)
  );
