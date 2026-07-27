-- 0012 — código de perfil, amizades e conversas diretas.
--
--   1. profiles.friend_code: código curto que vira QR. É ele que circula, não
--      o uuid da conta — assim dá para trocar o código sem trocar de conta.
--   2. friendships: pedido → aceite, com uma linha só por par.
--   3. dm_threads / dm_messages: conversa entre duas pessoas que já são amigas.
--   4. Whitelist dos efeitos, agora que existem decorações sazonais.

-- ====================================================== 1. CÓDIGO DE PERFIL

alter table public.profiles
  add column if not exists friend_code text;

update public.profiles
set friend_code = encode(gen_random_bytes(4), 'hex')
where friend_code is null;

alter table public.profiles
  alter column friend_code set default encode(gen_random_bytes(4), 'hex'),
  alter column friend_code set not null;

do $$ begin
  alter table public.profiles add constraint profiles_friend_code_key unique (friend_code);
exception when duplicate_table or duplicate_object then null;
end $$;

/** Gerar um código novo invalida QRs antigos — útil se o código vazar. */
create or replace function public.regenerate_friend_code()
returns text language plpgsql security definer set search_path = public as $$
declare
  v_code text := encode(gen_random_bytes(4), 'hex');
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

-- ============================================================ 2. AMIZADES

/**
 * Uma linha por par, sempre com user_a < user_b.
 *
 * A alternativa (duas linhas espelhadas) obriga a manter as duas em sincronia
 * a cada mudança de estado; com a ordenação canônica o par é a chave primária e
 * o banco impede pedido duplicado sozinho.
 */
create table if not exists public.friendships (
  user_a       uuid not null references public.profiles(id) on delete cascade,
  user_b       uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'pending',
  requested_by uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  primary key (user_a, user_b),
  constraint friendships_order_check  check (user_a < user_b),
  constraint friendships_status_check check (status in ('pending', 'accepted'))
);

create index if not exists idx_friendships_b on public.friendships (user_b);

alter table public.friendships enable row level security;

drop policy if exists "vê as próprias amizades" on public.friendships;
create policy "vê as próprias amizades" on public.friendships
  for select using (user_a = auth.uid() or user_b = auth.uid());

-- Criar e aceitar passam por função; inserção direta permitiria forjar um
-- aceite em nome do outro.
drop policy if exists "desfaz a própria amizade" on public.friendships;
create policy "desfaz a própria amizade" on public.friendships
  for delete using (user_a = auth.uid() or user_b = auth.uid());

/** Pedido de amizade pelo código do perfil (o que está no QR). */
create or replace function public.send_friend_request(p_friend_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_me     uuid := auth.uid();
  v_target uuid;
  v_a      uuid;
  v_b      uuid;
begin
  if v_me is null then
    raise exception 'Você precisa estar logado.';
  end if;

  select id into v_target from public.profiles where friend_code = lower(btrim(p_friend_code));
  if v_target is null then
    raise exception 'Código não encontrado.';
  end if;
  if v_target = v_me then
    raise exception 'Esse código é o seu.';
  end if;

  v_a := least(v_me, v_target);
  v_b := greatest(v_me, v_target);

  -- Se a outra pessoa já tinha pedido, este pedido fecha a amizade.
  if exists (
    select 1 from public.friendships
    where user_a = v_a and user_b = v_b and status = 'pending' and requested_by = v_target
  ) then
    update public.friendships
    set status = 'accepted', accepted_at = now()
    where user_a = v_a and user_b = v_b;
    return v_target;
  end if;

  insert into public.friendships (user_a, user_b, status, requested_by)
  values (v_a, v_b, 'pending', v_me)
  on conflict (user_a, user_b) do nothing;

  return v_target;
end;
$$;

create or replace function public.accept_friend_request(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_a  uuid := least(auth.uid(), p_user);
  v_b  uuid := greatest(auth.uid(), p_user);
begin
  if v_me is null then
    raise exception 'Você precisa estar logado.';
  end if;

  -- Só aceita quem NÃO fez o pedido; senão dava para aceitar sozinho.
  update public.friendships
  set status = 'accepted', accepted_at = now()
  where user_a = v_a and user_b = v_b and status = 'pending' and requested_by <> v_me;

  if not found then
    raise exception 'Não há pedido pendente dessa pessoa.';
  end if;
end;
$$;

revoke all on function public.send_friend_request(text) from public, anon;
revoke all on function public.accept_friend_request(uuid) from public, anon;
grant execute on function public.send_friend_request(text)  to authenticated;
grant execute on function public.accept_friend_request(uuid) to authenticated;

/** Lista plana: quem é a outra pessoa, o estado, e quem pediu. */
create or replace view public.my_friendships as
  select
    case when f.user_a = auth.uid() then f.user_b else f.user_a end as friend_id,
    f.status,
    f.requested_by,
    (f.requested_by = auth.uid()) as sent_by_me,
    f.created_at,
    f.accepted_at
  from public.friendships f
  where f.user_a = auth.uid() or f.user_b = auth.uid();

alter view public.my_friendships set (security_invoker = on);
grant select on public.my_friendships to authenticated;

-- ==================================================== 3. CONVERSAS DIRETAS

create table if not exists public.dm_threads (
  id         uuid primary key default gen_random_uuid(),
  user_a     uuid not null references public.profiles(id) on delete cascade,
  user_b     uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_a, user_b),
  constraint dm_threads_order_check check (user_a < user_b)
);

create table if not exists public.dm_messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.dm_threads(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_dm_messages_thread on public.dm_messages (thread_id, created_at desc);

alter table public.dm_threads  enable row level security;
alter table public.dm_messages enable row level security;

/** Participante da conversa. SECURITY DEFINER para a política não recursar. */
create or replace function public.in_dm_thread(p_thread uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.dm_threads t
    where t.id = p_thread and (t.user_a = auth.uid() or t.user_b = auth.uid())
  );
$$;

drop policy if exists "vê as próprias conversas" on public.dm_threads;
create policy "vê as próprias conversas" on public.dm_threads
  for select using (user_a = auth.uid() or user_b = auth.uid());

drop policy if exists "lê as mensagens da conversa" on public.dm_messages;
create policy "lê as mensagens da conversa" on public.dm_messages
  for select using (public.in_dm_thread(thread_id));

drop policy if exists "envia na própria conversa" on public.dm_messages;
create policy "envia na própria conversa" on public.dm_messages
  for insert with check (author_id = auth.uid() and public.in_dm_thread(thread_id));

drop policy if exists "apaga a própria mensagem" on public.dm_messages;
create policy "apaga a própria mensagem" on public.dm_messages
  for delete using (author_id = auth.uid());

/** Abre (ou reaproveita) a conversa com um amigo. Só entre amigos aceitos. */
create or replace function public.open_dm(p_user uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_a  uuid := least(auth.uid(), p_user);
  v_b  uuid := greatest(auth.uid(), p_user);
  v_id uuid;
begin
  if v_me is null then
    raise exception 'Você precisa estar logado.';
  end if;
  if v_me = p_user then
    raise exception 'Não dá para conversar consigo mesmo.';
  end if;

  if not exists (
    select 1 from public.friendships
    where user_a = v_a and user_b = v_b and status = 'accepted'
  ) then
    raise exception 'Vocês precisam ser amigos para conversar.';
  end if;

  select id into v_id from public.dm_threads where user_a = v_a and user_b = v_b;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.dm_threads (user_a, user_b) values (v_a, v_b) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.open_dm(uuid) from public, anon;
grant execute on function public.open_dm(uuid) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.dm_messages;
exception when duplicate_object then null;
end $$;

alter table public.dm_messages replica identity full;

-- ================================================ 4. EFEITOS PERMITIDOS

/**
 * Agora que existem decorações sazonais, o conjunto de efeitos válidos passa a
 * ser conferido. Sem isto, um POST direto na API gravaria qualquer string em
 * `effect` e o app renderizaria nada, sem explicar o porquê.
 */
create or replace function public.is_valid_effect(p_effect text)
returns boolean language sql immutable as $$
  select p_effect in (
    'none','glow','shine','snow','sparkle','hearts',
    'confetti','petals','stars','bubbles','leaves','bats'
  );
$$;

create or replace function public.validate_profile_customization()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_kind   text    := new.profile_theme->>'kind';
  v_effect text    := coalesce(new.profile_theme->>'effect', 'none');
  v_pro    boolean := public.is_pro(new.id);
begin
  if v_kind not in ('solid', 'gradient') then
    raise exception 'Tema inválido.';
  end if;
  if not public.is_valid_effect(v_effect) then
    raise exception 'Efeito desconhecido: %', v_effect;
  end if;
  if jsonb_array_length(coalesce(new.profile_theme->'colors', '[]'::jsonb)) = 0 then
    raise exception 'Escolha ao menos uma cor.';
  end if;
  if jsonb_array_length(new.profile_theme->'colors') > 4 then
    raise exception 'No máximo 4 cores no gradiente.';
  end if;
  if length(coalesce(new.bio, '')) > 300 then
    raise exception 'A bio precisa ter no máximo 300 caracteres.';
  end if;

  if not v_pro then
    if v_kind = 'gradient' then raise exception 'PRO_REQUIRED:gradient'; end if;
    if v_effect <> 'none' then raise exception 'PRO_REQUIRED:effect'; end if;
    if new.banner_url is not null then raise exception 'PRO_REQUIRED:banner'; end if;
    if new.avatar_url is not null and lower(new.avatar_url) like '%.gif' then
      raise exception 'PRO_REQUIRED:animated_icon';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.validate_group_customization()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_kind   text    := new.theme->>'kind';
  v_effect text    := coalesce(new.theme->>'effect', 'none');
  v_pro    boolean := public.is_pro(new.owner_id);
begin
  if v_kind not in ('solid', 'gradient') then
    raise exception 'Tema inválido.';
  end if;
  if not public.is_valid_effect(v_effect) then
    raise exception 'Efeito desconhecido: %', v_effect;
  end if;
  if jsonb_array_length(coalesce(new.theme->'colors', '[]'::jsonb)) = 0 then
    raise exception 'Escolha ao menos uma cor.';
  end if;
  if jsonb_array_length(new.theme->'colors') > 4 then
    raise exception 'No máximo 4 cores no gradiente.';
  end if;

  if not v_pro then
    if v_kind = 'gradient' then raise exception 'PRO_REQUIRED:gradient'; end if;
    if v_effect <> 'none' then raise exception 'PRO_REQUIRED:effect'; end if;
    if new.icon_url is not null and lower(new.icon_url) like '%.gif' then
      raise exception 'PRO_REQUIRED:animated_icon';
    end if;
    if new.banner_url is not null then raise exception 'PRO_REQUIRED:banner'; end if;
  end if;

  return new;
end;
$$;
