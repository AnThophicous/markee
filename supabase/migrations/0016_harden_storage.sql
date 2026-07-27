-- Endurecimento do storage.
--
-- Como estava, qualquer conta autenticada podia:
--   1. Enviar arquivo de QUALQUER tamanho — alguém sobe 5 GB e estoura a conta.
--   2. Enviar QUALQUER tipo de arquivo. Os buckets são públicos, então dava
--      para hospedar HTML de phishing num domínio nosso, ou SVG com script.
--   3. Escrever dentro da pasta de OUTRA pessoa (`outro-uuid/foto.png`), porque
--      a política só conferia o bucket, nunca o caminho. Com leitura pública,
--      isso permitia plantar uma imagem que parece ser de terceiro.
--
-- Nada disso dependia de mexer no app: bastava um POST direto na API. Agora que
-- o código é aberto e os nomes dos buckets são públicos, some qualquer
-- dificuldade de descobrir isso.

update storage.buckets
set file_size_limit = 8 * 1024 * 1024,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id in ('avatars', 'group-assets', 'uploads');

/**
 * Primeira pasta do caminho. `avatars/<uuid>/foto.png` devolve o `<uuid>`.
 */
create or replace function public.storage_owner_segment(p_name text)
returns text language sql immutable as $$
  select split_part(p_name, '/', 1);
$$;

drop policy if exists "autenticado envia arquivo" on storage.objects;
drop policy if exists "envia apenas na própria pasta" on storage.objects;

/**
 * Cada bucket tem a sua regra de dono:
 *   avatars, uploads → a pasta é o id de quem envia
 *   group-assets     → a pasta é um grupo onde a pessoa tem MANAGE_GROUP (1024)
 */
create policy "envia apenas na própria pasta" on storage.objects
  for insert to authenticated
  with check (
    (
      bucket_id in ('avatars', 'uploads')
      and public.storage_owner_segment(name) = auth.uid()::text
    )
    or (
      bucket_id = 'group-assets'
      and public.has_perm(nullif(public.storage_owner_segment(name), '')::uuid, 1024)
    )
  );

drop policy if exists "dono altera o próprio arquivo" on storage.objects;
-- UPDATE seguia só `owner = auth.uid()`, o que permitia mover o próprio arquivo
-- para a pasta de outra pessoa. Agora o destino obedece à mesma regra.
drop policy if exists "dono gerencia o próprio arquivo" on storage.objects;
create policy "dono altera o próprio arquivo" on storage.objects
  for update to authenticated
  using (owner = auth.uid())
  with check (
    owner = auth.uid()
    and (
      (
        bucket_id in ('avatars', 'uploads')
        and public.storage_owner_segment(name) = auth.uid()::text
      )
      or (
        bucket_id = 'group-assets'
        and public.has_perm(nullif(public.storage_owner_segment(name), '')::uuid, 1024)
      )
    )
  );

/**
 * O cast direto para uuid explode quando a pasta não é um uuid ("qualquer/x.png"),
 * e exceção dentro de política de RLS aborta a consulta inteira — inclusive uma
 * varredura de UPDATE que só passou por perto. A checagem passa a validar o
 * formato antes de converter, devolvendo NULL em vez de estourar.
 */
create or replace function public.storage_group_id(p_name text)
returns uuid language sql immutable as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then split_part(p_name, '/', 1)::uuid
  end;
$$;

drop policy if exists "envia apenas na própria pasta" on storage.objects;
create policy "envia apenas na própria pasta" on storage.objects
  for insert to authenticated
  with check (
    (
      bucket_id in ('avatars', 'uploads')
      and public.storage_owner_segment(name) = auth.uid()::text
    )
    or (
      bucket_id = 'group-assets'
      and public.storage_group_id(name) is not null
      and public.has_perm(public.storage_group_id(name), 1024)
    )
  );

drop policy if exists "dono altera o próprio arquivo" on storage.objects;
create policy "dono altera o próprio arquivo" on storage.objects
  for update to authenticated
  using (owner = auth.uid())
  with check (
    owner = auth.uid()
    and (
      (
        bucket_id in ('avatars', 'uploads')
        and public.storage_owner_segment(name) = auth.uid()::text
      )
      or (
        bucket_id = 'group-assets'
        and public.storage_group_id(name) is not null
        and public.has_perm(public.storage_group_id(name), 1024)
      )
    )
  );
