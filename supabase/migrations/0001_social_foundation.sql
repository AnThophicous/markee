-- Markee — fundação social
--
-- Modelo de permissões (bitfield, estilo Discord). Guardado em group_roles.permissions.
-- Um membro acumula (bit_or) as permissões de todos os cargos que possui.
--
--    1  VIEW_ROOM          ver salas e ler mensagens
--    2  SEND_MESSAGES      enviar mensagens
--    4  MANAGE_MESSAGES    apagar mensagens de outros
--    8  CREATE_POSTS       publicar no feed
--   16  MANAGE_POSTS       apagar posts de outros
--   32  UPLOAD_MATERIALS   enviar materiais de estudo
--   64  MANAGE_MATERIALS   apagar materiais de outros
--  128  MANAGE_ROOMS       criar/editar/apagar salas
--  256  MANAGE_ROLES       criar/editar cargos e atribuí-los
--  512  KICK_MEMBERS       remover membros
-- 1024  MANAGE_GROUP       nome, ícone, mascote do grupo
-- 2048  ADMINISTRATOR      concede tudo

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- perfis

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Estudante',
  avatar_url   text,
  bio          text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Cria o perfil automaticamente no cadastro.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Estudante')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- grupos

create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  icon_url    text,
  mascot_name text,
  mascot_url  text,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  join_code   text unique not null default encode(gen_random_bytes(4), 'hex'),
  is_public   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.group_roles (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  name        text not null,
  color       text not null default '#3A66F7',
  permissions bigint not null default 0,
  position    int not null default 0,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_group_roles_group on public.group_roles(group_id);

create table if not exists public.group_members (
  group_id  uuid not null references public.groups(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role_id   uuid references public.group_roles(id) on delete set null,
  nickname  text,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists idx_group_members_user on public.group_members(user_id);

-- ---------------------------------------------------------------- salas e mensagens

create table if not exists public.rooms (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id) on delete cascade,
  name       text not null,
  icon       text,
  kind       text not null default 'chat' check (kind in ('chat', 'feed', 'materials')),
  position   int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_rooms_group on public.rooms(group_id);

create table if not exists public.messages (
  id             uuid primary key default gen_random_uuid(),
  room_id        uuid not null references public.rooms(id) on delete cascade,
  author_id      uuid not null references auth.users(id) on delete cascade,
  content        text not null default '',
  attachment_url text,
  reply_to       uuid references public.messages(id) on delete set null,
  created_at     timestamptz not null default now(),
  edited_at      timestamptz
);
create index if not exists idx_messages_room on public.messages(room_id, created_at desc);

-- ---------------------------------------------------------------- feed

create table if not exists public.posts (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id) on delete cascade,
  author_id  uuid not null references auth.users(id) on delete cascade,
  content    text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_posts_group on public.posts(group_id, created_at desc);

create table if not exists public.post_images (
  id       uuid primary key default gen_random_uuid(),
  post_id  uuid not null references public.posts(id) on delete cascade,
  url      text not null,
  position int not null default 0
);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (post_id, user_id)
);

create table if not exists public.post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  author_id  uuid not null references auth.users(id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- materiais de estudo

create table if not exists public.study_materials (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  title       text not null,
  description text,
  file_url    text not null,
  file_type   text,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index if not exists idx_materials_group on public.study_materials(group_id, created_at desc);

-- ---------------------------------------------------------------- helpers de permissão
--
-- SECURITY DEFINER é obrigatório aqui: as políticas de RLS de group_members
-- precisam consultar group_members, o que causaria recursão infinita.

create or replace function public.is_group_member(p_group_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_group_owner(p_group_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.groups
    where id = p_group_id and owner_id = auth.uid()
  );
$$;

create or replace function public.group_permissions(p_group_id uuid)
returns bigint language sql security definer stable set search_path = public as $$
  select coalesce(bit_or(r.permissions), 0)
  from public.group_members m
  join public.group_roles r on r.id = m.role_id
  where m.group_id = p_group_id and m.user_id = auth.uid();
$$;

-- O dono sempre tem tudo; ADMINISTRATOR (2048) também.
create or replace function public.has_perm(p_group_id uuid, p_bit bigint)
returns boolean language sql security definer stable set search_path = public as $$
  select public.is_group_owner(p_group_id)
      or (public.group_permissions(p_group_id) & 2048) > 0
      or (public.group_permissions(p_group_id) & p_bit) > 0;
$$;

create or replace function public.room_group_id(p_room_id uuid)
returns uuid language sql security definer stable set search_path = public as $$
  select group_id from public.rooms where id = p_room_id;
$$;

-- ---------------------------------------------------------------- bootstrap de grupo
--
-- Ao criar um grupo: cria os cargos padrão, adiciona o criador como Admin
-- e abre uma sala inicial. Sem isso o grupo nasce inutilizável.

create or replace function public.handle_new_group()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  admin_role_id uuid;
begin
  insert into public.group_roles (group_id, name, color, permissions, position, is_default)
  values (new.id, 'Admin', '#E5484D', 2048, 100, false)
  returning id into admin_role_id;

  -- @todos: ver salas, mandar mensagem, postar no feed, enviar materiais
  insert into public.group_roles (group_id, name, color, permissions, position, is_default)
  values (new.id, 'Membro', '#8A8A8E', 1 | 2 | 8 | 32, 0, true);

  insert into public.group_members (group_id, user_id, role_id)
  values (new.id, new.owner_id, admin_role_id);

  insert into public.rooms (group_id, name, kind, position)
  values (new.id, 'geral', 'chat', 0);

  return new;
end;
$$;

drop trigger if exists on_group_created on public.groups;
create trigger on_group_created
  after insert on public.groups
  for each row execute function public.handle_new_group();

-- ---------------------------------------------------------------- RLS

alter table public.profiles        enable row level security;
alter table public.groups          enable row level security;
alter table public.group_roles     enable row level security;
alter table public.group_members   enable row level security;
alter table public.rooms           enable row level security;
alter table public.messages        enable row level security;
alter table public.posts           enable row level security;
alter table public.post_images     enable row level security;
alter table public.post_likes      enable row level security;
alter table public.post_comments   enable row level security;
alter table public.study_materials enable row level security;

-- perfis: visíveis a quem está logado (para exibir nome/avatar), editáveis só pelo dono
create policy "perfis visíveis a autenticados" on public.profiles
  for select to authenticated using (true);
create policy "edita o próprio perfil" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- grupos
create policy "vê grupos que participa ou públicos" on public.groups
  for select to authenticated using (is_public or public.is_group_member(id));
create policy "cria grupo como dono" on public.groups
  for insert to authenticated with check (owner_id = auth.uid());
create policy "edita grupo com MANAGE_GROUP" on public.groups
  for update to authenticated using (public.has_perm(id, 1024)) with check (public.has_perm(id, 1024));
create policy "só o dono apaga o grupo" on public.groups
  for delete to authenticated using (owner_id = auth.uid());

-- cargos
create policy "membros veem os cargos" on public.group_roles
  for select to authenticated using (public.is_group_member(group_id));
create policy "gerencia cargos com MANAGE_ROLES" on public.group_roles
  for all to authenticated
  using (public.has_perm(group_id, 256)) with check (public.has_perm(group_id, 256));

-- membros
create policy "membros veem os membros" on public.group_members
  for select to authenticated using (public.is_group_member(group_id));
create policy "entra no grupo por si mesmo" on public.group_members
  for insert to authenticated with check (user_id = auth.uid());
create policy "atribui cargo com MANAGE_ROLES" on public.group_members
  for update to authenticated
  using (public.has_perm(group_id, 256)) with check (public.has_perm(group_id, 256));
create policy "sai do grupo ou é removido com KICK_MEMBERS" on public.group_members
  for delete to authenticated using (user_id = auth.uid() or public.has_perm(group_id, 512));

-- salas
create policy "membros com VIEW_ROOM veem as salas" on public.rooms
  for select to authenticated using (public.has_perm(group_id, 1));
create policy "gerencia salas com MANAGE_ROOMS" on public.rooms
  for all to authenticated
  using (public.has_perm(group_id, 128)) with check (public.has_perm(group_id, 128));

-- mensagens
create policy "lê mensagens com VIEW_ROOM" on public.messages
  for select to authenticated using (public.has_perm(public.room_group_id(room_id), 1));
create policy "envia mensagem com SEND_MESSAGES" on public.messages
  for insert to authenticated
  with check (author_id = auth.uid() and public.has_perm(public.room_group_id(room_id), 2));
create policy "edita a própria mensagem" on public.messages
  for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "apaga a própria ou com MANAGE_MESSAGES" on public.messages
  for delete to authenticated
  using (author_id = auth.uid() or public.has_perm(public.room_group_id(room_id), 4));

-- feed
create policy "membros leem o feed" on public.posts
  for select to authenticated using (public.is_group_member(group_id));
create policy "publica com CREATE_POSTS" on public.posts
  for insert to authenticated
  with check (author_id = auth.uid() and public.has_perm(group_id, 8));
create policy "edita o próprio post" on public.posts
  for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "apaga o próprio post ou com MANAGE_POSTS" on public.posts
  for delete to authenticated using (author_id = auth.uid() or public.has_perm(group_id, 16));

create policy "imagens seguem o post" on public.post_images
  for select to authenticated using (
    exists (select 1 from public.posts p where p.id = post_id and public.is_group_member(p.group_id))
  );
create policy "anexa imagem ao próprio post" on public.post_images
  for all to authenticated using (
    exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid())
  ) with check (
    exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid())
  );

create policy "membros veem curtidas" on public.post_likes
  for select to authenticated using (
    exists (select 1 from public.posts p where p.id = post_id and public.is_group_member(p.group_id))
  );
create policy "curte por si mesmo" on public.post_likes
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "membros leem comentários" on public.post_comments
  for select to authenticated using (
    exists (select 1 from public.posts p where p.id = post_id and public.is_group_member(p.group_id))
  );
create policy "comenta como membro" on public.post_comments
  for insert to authenticated with check (
    author_id = auth.uid()
    and exists (select 1 from public.posts p where p.id = post_id and public.is_group_member(p.group_id))
  );
create policy "apaga o próprio comentário" on public.post_comments
  for delete to authenticated using (author_id = auth.uid());

-- materiais
create policy "membros veem os materiais" on public.study_materials
  for select to authenticated using (public.is_group_member(group_id));
create policy "envia material com UPLOAD_MATERIALS" on public.study_materials
  for insert to authenticated
  with check (uploaded_by = auth.uid() and public.has_perm(group_id, 32));
create policy "apaga o próprio material ou com MANAGE_MATERIALS" on public.study_materials
  for delete to authenticated
  using (uploaded_by = auth.uid() or public.has_perm(group_id, 64));

-- ---------------------------------------------------------------- storage

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true), ('group-assets', 'group-assets', true), ('uploads', 'uploads', true)
on conflict (id) do nothing;

create policy "arquivos públicos são legíveis" on storage.objects
  for select using (bucket_id in ('avatars', 'group-assets', 'uploads'));
create policy "autenticado envia arquivo" on storage.objects
  for insert to authenticated with check (bucket_id in ('avatars', 'group-assets', 'uploads'));
create policy "dono gerencia o próprio arquivo" on storage.objects
  for update to authenticated using (owner = auth.uid());
create policy "dono apaga o próprio arquivo" on storage.objects
  for delete to authenticated using (owner = auth.uid());
