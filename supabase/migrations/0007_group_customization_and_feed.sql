-- Personalização de grupo + feed.
--
-- Gratuito : cor sólida, ícone estático (PNG/JPG/WebP)
-- Pro      : gradiente, efeitos, ícone animado (GIF), banner
--
-- A separação é validada por gatilho no banco. Fazer isso só no app seria
-- decoração: bastaria um POST direto na API para ter gradiente sem pagar.

alter table public.groups
  add column if not exists theme      jsonb not null default '{"kind":"solid","colors":["#F62283"],"effect":"none"}'::jsonb,
  add column if not exists banner_url text;

alter table public.posts
  add column if not exists is_pinned  boolean not null default false,
  add column if not exists edited_at  timestamptz;

create index if not exists idx_posts_pinned on public.posts (group_id, is_pinned desc, created_at desc);

-- ---------------------------------------------------------------- plano

create or replace function public.is_pro(p_user uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select public.current_plan(p_user) <> 'free';
$$;

/**
 * Recursos premium exigem Pro do DONO do grupo — quem banca a customização é
 * quem criou, não quem está editando. Assim um admin Pro não deixa um grupo
 * "premium" que passa a valer para sempre depois que ele sai.
 */
create or replace function public.validate_group_customization()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_kind   text := new.theme->>'kind';
  v_effect text := coalesce(new.theme->>'effect', 'none');
  v_pro    boolean := public.is_pro(new.owner_id);
begin
  if v_kind not in ('solid', 'gradient') then
    raise exception 'Tema inválido.';
  end if;

  if jsonb_array_length(coalesce(new.theme->'colors', '[]'::jsonb)) = 0 then
    raise exception 'Escolha ao menos uma cor.';
  end if;

  if not v_pro then
    if v_kind = 'gradient' then
      raise exception 'PRO_REQUIRED:gradient';
    end if;
    if v_effect <> 'none' then
      raise exception 'PRO_REQUIRED:effect';
    end if;
    if new.icon_url is not null and lower(new.icon_url) like '%.gif' then
      raise exception 'PRO_REQUIRED:animated_icon';
    end if;
    if new.banner_url is not null then
      raise exception 'PRO_REQUIRED:banner';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_group_customization on public.groups;
create trigger on_group_customization
  before insert or update of theme, icon_url, banner_url on public.groups
  for each row execute function public.validate_group_customization();

-- ---------------------------------------------------------------- feed

/** Fixar post exige MANAGE_POSTS; o resto segue as políticas já existentes. */
create or replace function public.set_post_pinned(p_post_id uuid, p_pinned boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_group uuid;
begin
  select group_id into v_group from public.posts where id = p_post_id;
  if v_group is null then
    raise exception 'Post não encontrado.';
  end if;
  if not public.has_perm(v_group, 16) then
    raise exception 'Você não tem permissão para fixar posts.';
  end if;

  update public.posts set is_pinned = p_pinned where id = p_post_id;
end;
$$;

revoke all on function public.set_post_pinned(uuid, boolean) from public, anon;
grant execute on function public.set_post_pinned(uuid, boolean) to authenticated;

-- Editar o próprio post carimba a data, para a interface poder mostrar "editado".
create or replace function public.touch_post_edited()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.content is distinct from old.content then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists on_post_edited on public.posts;
create trigger on_post_edited
  before update on public.posts
  for each row execute function public.touch_post_edited();

-- Contagem de curtidas e comentários sem N+1 no cliente.
create or replace view public.posts_with_counts as
  select
    p.*,
    (select count(*) from public.post_likes    l where l.post_id = p.id) as like_count,
    (select count(*) from public.post_comments c where c.post_id = p.id) as comment_count,
    exists (select 1 from public.post_likes l where l.post_id = p.id and l.user_id = auth.uid()) as liked_by_me
  from public.posts p;

grant select on public.posts_with_counts to authenticated;
