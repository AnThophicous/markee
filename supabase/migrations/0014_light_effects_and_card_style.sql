-- As decorações de emoji saíram. No lugar entram efeitos de luz e gradiente,
-- mais o estilo do cartão do grupo (como ele aparece para os outros).
--
-- Temas já gravados apontam para efeitos que não existem mais ('snow', 'bats',
-- ...). Se ficassem, o gatilho passaria a recusar QUALQUER edição futura desses
-- registros — a validação roda no UPDATE inteiro, não só no que mudou. Por isso
-- eles são convertidos aqui, antes da whitelist nova entrar em vigor.

update public.profiles
set profile_theme = jsonb_set(
      coalesce(profile_theme, '{}'::jsonb),
      '{effect}',
      case profile_theme->>'effect'
        when 'sparkle' then '"sweep"'::jsonb
        when 'stars'   then '"sweep"'::jsonb
        when 'bubbles' then '"pulse"'::jsonb
        else '"none"'::jsonb
      end
    )
where profile_theme->>'effect' not in ('none', 'glow', 'shine', 'sweep', 'pulse', 'shift', 'spin');

update public.groups
set theme = jsonb_set(
      coalesce(theme, '{}'::jsonb),
      '{effect}',
      case theme->>'effect'
        when 'sparkle' then '"sweep"'::jsonb
        when 'stars'   then '"sweep"'::jsonb
        when 'bubbles' then '"pulse"'::jsonb
        else '"none"'::jsonb
      end
    )
where theme->>'effect' not in ('none', 'glow', 'shine', 'sweep', 'pulse', 'shift', 'spin');

create or replace function public.is_valid_effect(p_effect text)
returns boolean language sql immutable as $$
  select p_effect in ('none', 'shine', 'glow', 'sweep', 'pulse', 'shift', 'spin');
$$;

create or replace function public.is_valid_card(p_card text)
returns boolean language sql immutable as $$
  select p_card in ('plain', 'tinted', 'cover');
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
  v_card   text    := coalesce(new.theme->>'card', 'plain');
  v_pro    boolean := public.is_pro(new.owner_id);
begin
  if v_kind not in ('solid', 'gradient') then
    raise exception 'Tema inválido.';
  end if;
  if not public.is_valid_effect(v_effect) then
    raise exception 'Efeito desconhecido: %', v_effect;
  end if;
  if not public.is_valid_card(v_card) then
    raise exception 'Estilo de cartão desconhecido: %', v_card;
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
    if v_card <> 'plain' then raise exception 'PRO_REQUIRED:card'; end if;
    if new.icon_url is not null and lower(new.icon_url) like '%.gif' then
      raise exception 'PRO_REQUIRED:animated_icon';
    end if;
    if new.banner_url is not null then raise exception 'PRO_REQUIRED:banner'; end if;
  end if;

  return new;
end;
$$;
