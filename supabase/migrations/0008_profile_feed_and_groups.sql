-- 0008 — perfil personalizável, feed mais completo e grupos com agenda.
--
-- Três blocos:
--   1. Perfil: banner, cor de destaque, pronomes, headline. Gradiente/efeito/
--      banner/avatar animado são Pro, validados por gatilho (não no app).
--   2. Feed: enquetes, comentários em resposta, moderação de comentário.
--   3. Grupos: agenda de eventos + create_group idempotente (o toque duplo
--      no botão criava dois grupos iguais).

-- ============================================================ 1. PERFIL

alter table public.profiles
  add column if not exists banner_url    text,
  add column if not exists pronouns      text,
  add column if not exists headline      text,
  add column if not exists profile_theme jsonb not null
    default '{"kind":"solid","colors":["#F62283"],"effect":"none"}'::jsonb;

/**
 * Mesma regra do grupo: quem não é Pro fica na cor sólida. A validação mora
 * aqui porque bloquear só na interface seria decoração — um POST direto na
 * API teria gradiente de graça.
 */
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

  if jsonb_array_length(coalesce(new.profile_theme->'colors', '[]'::jsonb)) = 0 then
    raise exception 'Escolha ao menos uma cor.';
  end if;

  if length(coalesce(new.bio, '')) > 300 then
    raise exception 'A bio precisa ter no máximo 300 caracteres.';
  end if;

  if not v_pro then
    if v_kind = 'gradient' then
      raise exception 'PRO_REQUIRED:gradient';
    end if;
    if v_effect <> 'none' then
      raise exception 'PRO_REQUIRED:effect';
    end if;
    if new.banner_url is not null then
      raise exception 'PRO_REQUIRED:banner';
    end if;
    if new.avatar_url is not null and lower(new.avatar_url) like '%.gif' then
      raise exception 'PRO_REQUIRED:animated_icon';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_profile_customization on public.profiles;
create trigger on_profile_customization
  before insert or update of profile_theme, banner_url, avatar_url, bio on public.profiles
  for each row execute function public.validate_profile_customization();

-- ============================================================ 2. FEED

alter table public.posts
  add column if not exists kind text not null default 'text';

do $$ begin
  alter table public.posts add constraint posts_kind_check check (kind in ('text', 'poll'));
exception when duplicate_object then null;
end $$;

alter table public.post_comments
  add column if not exists parent_id uuid references public.post_comments(id) on delete cascade;

create index if not exists idx_comments_parent on public.post_comments (post_id, parent_id, created_at);

-- Moderador do grupo também apaga comentário (antes só o autor conseguia).
drop policy if exists "modera comentários com MANAGE_POSTS" on public.post_comments;
create policy "modera comentários com MANAGE_POSTS" on public.post_comments
  for delete using (
    exists (select 1 from public.posts p where p.id = post_comments.post_id and public.has_perm(p.group_id, 16))
  );

-- ---------------------------------------------------------- enquetes

create table if not exists public.post_polls (
  post_id        uuid primary key references public.posts(id) on delete cascade,
  question       text not null,
  allow_multiple boolean not null default false,
  closes_at      timestamptz
);

create table if not exists public.poll_options (
  id       uuid primary key default gen_random_uuid(),
  post_id  uuid not null references public.post_polls(post_id) on delete cascade,
  label    text not null,
  position integer not null default 0
);

create table if not exists public.poll_votes (
  post_id   uuid not null references public.post_polls(post_id) on delete cascade,
  option_id uuid not null references public.poll_options(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  primary key (option_id, user_id)
);

create index if not exists idx_poll_options_post on public.poll_options (post_id, position);
create index if not exists idx_poll_votes_post   on public.poll_votes (post_id, user_id);

alter table public.post_polls   enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes   enable row level security;

-- A enquete herda a visibilidade do post: quem lê o feed, lê a enquete.
drop policy if exists "membros leem a enquete" on public.post_polls;
create policy "membros leem a enquete" on public.post_polls
  for select using (
    exists (select 1 from public.posts p where p.id = post_polls.post_id and public.is_group_member(p.group_id))
  );

drop policy if exists "cria enquete no próprio post" on public.post_polls;
create policy "cria enquete no próprio post" on public.post_polls
  for all
  using (exists (select 1 from public.posts p where p.id = post_polls.post_id and p.author_id = auth.uid()))
  with check (exists (select 1 from public.posts p where p.id = post_polls.post_id and p.author_id = auth.uid()));

drop policy if exists "membros leem as opções" on public.poll_options;
create policy "membros leem as opções" on public.poll_options
  for select using (
    exists (select 1 from public.posts p where p.id = poll_options.post_id and public.is_group_member(p.group_id))
  );

drop policy if exists "cria opções no próprio post" on public.poll_options;
create policy "cria opções no próprio post" on public.poll_options
  for all
  using (exists (select 1 from public.posts p where p.id = poll_options.post_id and p.author_id = auth.uid()))
  with check (exists (select 1 from public.posts p where p.id = poll_options.post_id and p.author_id = auth.uid()));

drop policy if exists "membros veem os votos" on public.poll_votes;
create policy "membros veem os votos" on public.poll_votes
  for select using (
    exists (select 1 from public.posts p where p.id = poll_votes.post_id and public.is_group_member(p.group_id))
  );

-- Voto entra pela função vote_poll, que aplica o "escolha única" numa
-- transação só. Inserção direta continua barrada para não furar essa regra.
drop policy if exists "retira o próprio voto" on public.poll_votes;
create policy "retira o próprio voto" on public.poll_votes
  for delete using (user_id = auth.uid());

/**
 * Voto atômico. Em enquete de escolha única, apagar o voto anterior e inserir
 * o novo precisa acontecer junto — senão dois toques rápidos deixam a pessoa
 * com dois votos.
 */
create or replace function public.vote_poll(p_option_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_post     uuid;
  v_group    uuid;
  v_multiple boolean;
  v_closes   timestamptz;
  v_existing boolean;
begin
  select o.post_id, pp.allow_multiple, pp.closes_at
    into v_post, v_multiple, v_closes
  from public.poll_options o
  join public.post_polls pp on pp.post_id = o.post_id
  where o.id = p_option_id;

  if v_post is null then
    raise exception 'Enquete não encontrada.';
  end if;

  select group_id into v_group from public.posts where id = v_post;
  if not public.is_group_member(v_group) then
    raise exception 'Você não participa deste grupo.';
  end if;

  if v_closes is not null and v_closes < now() then
    raise exception 'Esta enquete já encerrou.';
  end if;

  select exists (
    select 1 from public.poll_votes where option_id = p_option_id and user_id = auth.uid()
  ) into v_existing;

  -- Tocar de novo na opção já votada desfaz o voto.
  if v_existing then
    delete from public.poll_votes where option_id = p_option_id and user_id = auth.uid();
    return;
  end if;

  if not v_multiple then
    delete from public.poll_votes where post_id = v_post and user_id = auth.uid();
  end if;

  insert into public.poll_votes (post_id, option_id, user_id)
  values (v_post, p_option_id, auth.uid());
end;
$$;

revoke all on function public.vote_poll(uuid) from public, anon;
grant execute on function public.vote_poll(uuid) to authenticated;

create or replace view public.poll_options_with_counts as
  select
    o.id,
    o.post_id,
    o.label,
    o.position,
    (select count(*) from public.poll_votes v where v.option_id = o.id) as vote_count,
    exists (select 1 from public.poll_votes v where v.option_id = o.id and v.user_id = auth.uid()) as voted_by_me
  from public.poll_options o;

grant select on public.poll_options_with_counts to authenticated;

-- ============================================================ 3. GRUPOS

create table if not exists public.group_events (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  title       text not null,
  description text,
  starts_at   timestamptz not null,
  created_by  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index if not exists idx_events_group on public.group_events (group_id, starts_at);

alter table public.group_events enable row level security;

drop policy if exists "membros veem a agenda" on public.group_events;
create policy "membros veem a agenda" on public.group_events
  for select using (public.is_group_member(group_id));

drop policy if exists "membro marca evento" on public.group_events;
create policy "membro marca evento" on public.group_events
  for insert with check (created_by = auth.uid() and public.is_group_member(group_id));

drop policy if exists "apaga o próprio evento ou com MANAGE_POSTS" on public.group_events;
create policy "apaga o próprio evento ou com MANAGE_POSTS" on public.group_events
  for delete using (created_by = auth.uid() or public.has_perm(group_id, 16));

drop policy if exists "edita o próprio evento" on public.group_events;
create policy "edita o próprio evento" on public.group_events
  for update using (created_by = auth.uid()) with check (created_by = auth.uid());

/**
 * Criação de grupo idempotente numa janela curta.
 *
 * O toque duplo no botão "Criar" mandava dois INSERTs e o usuário terminava
 * com dois grupos idênticos. Travar o botão no app ajuda, mas não resolve
 * requisição repetida por rede lenta — então a regra fica no servidor:
 * pedir o mesmo nome duas vezes em 15s devolve o grupo já criado.
 */
create or replace function public.create_group(p_name text, p_description text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user     uuid := auth.uid();
  v_name     text := btrim(p_name);
  v_existing uuid;
  v_id       uuid;
begin
  if v_user is null then
    raise exception 'Você precisa estar logado.';
  end if;
  if v_name = '' then
    raise exception 'Dê um nome ao grupo.';
  end if;

  select id into v_existing
  from public.groups
  where owner_id = v_user
    and lower(name) = lower(v_name)
    and created_at > now() - interval '15 seconds'
  order by created_at desc
  limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  insert into public.groups (name, description, owner_id)
  values (v_name, nullif(btrim(coalesce(p_description, '')), ''), v_user)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_group(text, text) from public, anon;
grant execute on function public.create_group(text, text) to authenticated;

/** Apagar o grupo é do dono; expõe como RPC só para dar erro em português. */
create or replace function public.delete_group(p_group_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.groups where id = p_group_id and owner_id = auth.uid()) then
    raise exception 'Só o dono pode apagar o grupo.';
  end if;
  delete from public.groups where id = p_group_id;
end;
$$;

revoke all on function public.delete_group(uuid) from public, anon;
grant execute on function public.delete_group(uuid) to authenticated;

-- Agenda e enquete também chegam ao vivo.
do $$ begin
  alter publication supabase_realtime add table public.poll_votes;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.group_events;
exception when duplicate_object then null;
end $$;

/**
 * posts_with_counts precisa ser recriada, não só substituída.
 *
 * A view foi definida com `select p.*`, e o Postgres expande esse asterisco no
 * momento da criação — a lista de colunas fica congelada. Como `kind` nasceu
 * depois, a view não a enxergaria e toda consulta de enquete falharia. Daqui em
 * diante as colunas ficam explícitas, para o congelamento ser visível no código.
 */
drop view if exists public.posts_with_counts;

create view public.posts_with_counts as
  select
    p.id,
    p.group_id,
    p.author_id,
    p.kind,
    p.content,
    p.created_at,
    p.edited_at,
    p.is_pinned,
    (select count(*) from public.post_likes    l where l.post_id = p.id) as like_count,
    (select count(*) from public.post_comments c where c.post_id = p.id) as comment_count,
    exists (select 1 from public.post_likes l where l.post_id = p.id and l.user_id = auth.uid()) as liked_by_me
  from public.posts p;

grant select on public.posts_with_counts to authenticated;
