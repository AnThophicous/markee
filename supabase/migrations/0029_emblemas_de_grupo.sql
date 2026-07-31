-- Emblemas: o que aparece do seu lado no grupo, para os outros verem.
--
-- ESTA É A DIFERENÇA ENTRE EMBLEMA E MEDALHA, e ela é de segurança, não de
-- vocabulário:
--
--   MEDALHA  vive no banco do aparelho (dias de estudo, cartas revisadas,
--            minutos gravados). Um APK modificado se dá todas, e o estrago é
--            zero, porque medalha só aparece para quem a conquistou.
--
--   EMBLEMA  aparece para OS OUTROS. Então ele não pode sair do aparelho de
--            ninguém: cada um é calculado aqui, agora, do que o servidor viu
--            acontecer — a assinatura que a loja confirmou, a data em que a
--            conta foi criada, as mensagens que passaram por esta tabela.
--
-- O aplicativo não envia emblema, não guarda emblema e não tem como pedir um.
-- Ele recebe uma lista pronta e desenha. Um APK modificado continua conseguindo
-- se enfeitar à vontade — e continua sem conseguir mentir para mais ninguém.

create index if not exists idx_messages_author on public.messages (author_id);
create index if not exists idx_posts_author on public.posts (author_id);

/**
 * Os emblemas de todo mundo do grupo, de uma vez.
 *
 * De uma vez, e não um por membro, porque a lista de membros desenha todos na
 * mesma tela: uma chamada por pessoa seria uma tempestade de requisições toda
 * vez que alguém abrisse a aba.
 *
 * SECURITY DEFINER para poder contar mensagens e curtidas de terceiros (o RLS
 * normal esconde parte disso), e por isso mesmo a primeira coisa que ela faz é
 * conferir se quem pergunta é do grupo. Sem essa linha, qualquer conta poderia
 * varrer a composição de qualquer grupo do app.
 */
create or replace function public.emblemas_do_grupo(p_group uuid)
returns table (user_id uuid, emblema text)
language sql stable security definer set search_path = public as $$
  with permitido as (
    select public.is_group_member(p_group) as ok
  ),
  membros as (
    select m.user_id,
           row_number() over (order by m.joined_at, m.user_id) as ordem
    from public.group_members m
    where m.group_id = p_group and (select ok from permitido)
  ),
  mensagens as (
    select msg.author_id, count(*) as n
    from public.messages msg
    join public.rooms r on r.id = msg.room_id
    where r.group_id = p_group
    group by msg.author_id
  ),
  publicacoes as (
    select p.author_id, count(*) as n
    from public.posts p
    where p.group_id = p_group
    group by p.author_id
  ),
  curtidas as (
    -- Curtida em si mesmo não conta. Sem esta linha o emblema de "bem quisto"
    -- seria conquistado sozinho, publicando cinquenta vezes e curtindo tudo.
    select p.author_id, count(*) as n
    from public.post_likes l
    join public.posts p on p.id = l.post_id
    where p.group_id = p_group and l.user_id <> p.author_id
    group by p.author_id
  )
  select m.user_id, e.emblema
  from membros m
  cross join lateral (
    select 'dono'::text as emblema
    where exists (select 1 from public.groups g where g.id = p_group and g.owner_id = m.user_id)

    union all
    select 'fundador'
    where m.ordem <= 10

    union all
    select 'pro'
    where public.is_pro(m.user_id)

    union all
    select 'veterano'
    where exists (
      select 1 from public.profiles pr
      where pr.id = m.user_id and pr.created_at <= now() - interval '180 days'
    )

    union all
    select 'conversador'
    where coalesce((select n from mensagens where author_id = m.user_id), 0) >= 100

    union all
    select 'voz'
    where coalesce((select n from mensagens where author_id = m.user_id), 0) >= 1000

    union all
    select 'autor'
    where coalesce((select n from publicacoes where author_id = m.user_id), 0) >= 10

    union all
    select 'querido'
    where coalesce((select n from curtidas where author_id = m.user_id), 0) >= 50

    union all
    select 'padrinho'
    where exists (
      select 1 from public.affiliate_commissions c where c.referrer_id = m.user_id
    )
  ) e;
$$;

revoke all on function public.emblemas_do_grupo(uuid) from public, anon;
grant execute on function public.emblemas_do_grupo(uuid) to authenticated;

/**
 * Os emblemas que a pessoa carrega para qualquer lugar, para o perfil público.
 *
 * Só os que não dependem de grupo. "Dono" vira "fundou um grupo", porque no
 * perfil não existe um grupo de referência — e dizer só "dono" sem dizer de quê
 * não significa nada.
 */
create or replace function public.emblemas_do_perfil(p_user uuid)
returns table (emblema text)
language sql stable security definer set search_path = public as $$
  select 'pro' where public.is_pro(p_user)
  union all
  select 'veterano' where exists (
    select 1 from public.profiles pr
    where pr.id = p_user and pr.created_at <= now() - interval '180 days'
  )
  union all
  select 'padrinho' where exists (
    select 1 from public.affiliate_commissions c where c.referrer_id = p_user
  )
  union all
  select 'fundou' where exists (
    select 1 from public.groups g where g.owner_id = p_user
  );
$$;

revoke all on function public.emblemas_do_perfil(uuid) from public, anon;
grant execute on function public.emblemas_do_perfil(uuid) to authenticated;
