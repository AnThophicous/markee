-- Planos e cotas de uso.
--
-- Princípio: só é pago o que custa dinheiro de verdade (inferência de IA e
-- transcrição). Notas, pastas, tags, busca, grupos e chat continuam gratuitos e
-- ilimitados — o app nunca fica inútil sem pagar.
--
-- A contagem vive no banco e é conferida por uma função SECURITY DEFINER.
-- Checagem de cota no cliente seria decoração: bastaria chamar a API direto.

create table if not exists public.plans (
  id                    text primary key,
  name                  text not null,
  price_cents           int  not null default 0,
  ai_calls_per_month    int  not null,
  transcribe_min_month  int  not null
);

insert into public.plans (id, name, price_cents, ai_calls_per_month, transcribe_min_month)
values
  ('free', 'Gratuito',  0,  20,   60),
  ('pro',  'Pro',       990, 500, 1200)
on conflict (id) do update
  set name = excluded.name,
      price_cents = excluded.price_cents,
      ai_calls_per_month = excluded.ai_calls_per_month,
      transcribe_min_month = excluded.transcribe_min_month;

create table if not exists public.subscriptions (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  plan_id     text not null references public.plans(id) default 'free',
  status      text not null default 'active' check (status in ('active','canceled','past_due')),
  renews_at   timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.usage_events (
  id         bigserial primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('ai_call','transcribe_minute')),
  amount     int  not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists idx_usage_user_month
  on public.usage_events (user_id, kind, created_at desc);

-- Plano efetivo: assinatura vencida ou cancelada volta a valer como gratuito.
create or replace function public.current_plan(p_user uuid)
returns text language sql security definer stable set search_path = public as $$
  select coalesce(
    (select s.plan_id from public.subscriptions s
      where s.user_id = p_user
        and s.status = 'active'
        and (s.renews_at is null or s.renews_at > now())),
    'free'
  );
$$;

create or replace function public.usage_this_month(p_user uuid, p_kind text)
returns int language sql security definer stable set search_path = public as $$
  select coalesce(sum(amount), 0)::int
    from public.usage_events
   where user_id = p_user
     and kind = p_kind
     and created_at >= date_trunc('month', now());
$$;

/**
 * Consome cota de forma atômica. Devolve quanto sobrou.
 * Levanta exceção quando o limite do mês acabou — quem chama trata a mensagem.
 */
create or replace function public.consume_quota(p_kind text, p_amount int default 1)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_user  uuid := auth.uid();
  v_plan  text;
  v_limit int;
  v_used  int;
begin
  if v_user is null then
    raise exception 'Você precisa estar logado.';
  end if;
  if p_amount <= 0 then
    raise exception 'Quantidade inválida.';
  end if;

  v_plan := public.current_plan(v_user);

  select case p_kind
           when 'ai_call'           then ai_calls_per_month
           when 'transcribe_minute' then transcribe_min_month
         end
    into v_limit
    from public.plans where id = v_plan;

  if v_limit is null then
    raise exception 'Tipo de uso desconhecido: %', p_kind;
  end if;

  -- Trava a linha do usuário para que duas chamadas simultâneas não passem
  -- ambas pela última unidade de cota.
  perform 1 from public.subscriptions where user_id = v_user for update;

  v_used := public.usage_this_month(v_user, p_kind);

  if v_used + p_amount > v_limit then
    raise exception 'QUOTA_EXCEEDED:%:%:%', p_kind, v_used, v_limit;
  end if;

  insert into public.usage_events (user_id, kind, amount)
  values (v_user, p_kind, p_amount);

  return v_limit - (v_used + p_amount);
end;
$$;

/** Resumo para a tela de configurações. */
create or replace function public.my_usage()
returns table (plan text, ai_used int, ai_limit int, min_used int, min_limit int)
language sql security definer stable set search_path = public as $$
  select
    public.current_plan(auth.uid()),
    public.usage_this_month(auth.uid(), 'ai_call'),
    p.ai_calls_per_month,
    public.usage_this_month(auth.uid(), 'transcribe_minute'),
    p.transcribe_min_month
  from public.plans p
  where p.id = public.current_plan(auth.uid());
$$;

-- Cria assinatura gratuita junto com o perfil.
create or replace function public.handle_new_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.subscriptions (user_id, plan_id)
  values (new.id, 'free')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_profile_created on public.profiles;
create trigger on_profile_created
  after insert on public.profiles
  for each row execute function public.handle_new_profile();

insert into public.subscriptions (user_id, plan_id)
  select id, 'free' from public.profiles
  on conflict (user_id) do nothing;

-- ---------------------------------------------------------------- RLS

alter table public.plans         enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_events  enable row level security;

create policy "planos sao publicos" on public.plans
  for select to authenticated using (true);

-- Leitura apenas. Trocar de plano é papel do webhook de pagamento, que usa a
-- service key e ignora RLS — sem isso qualquer um se promoveria a Pro.
create policy "ve a propria assinatura" on public.subscriptions
  for select to authenticated using (user_id = auth.uid());

create policy "ve o proprio consumo" on public.usage_events
  for select to authenticated using (user_id = auth.uid());

revoke all on function public.consume_quota(text, int) from public, anon;
grant execute on function public.consume_quota(text, int) to authenticated;
grant execute on function public.my_usage() to authenticated;
