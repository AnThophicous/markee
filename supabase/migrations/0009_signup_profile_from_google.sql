-- Cadastro pelo Google trazia só o pedaço do e-mail antes do @ como nome. O
-- Google manda `full_name`/`name` em raw_user_meta_data — dá para começar com
-- o nome certo.
--
-- A FOTO do Google fica de fora de propósito. Ela é hospedada no
-- lh3.googleusercontent.com, e a regra do app é só exibir imagem do nosso
-- próprio storage: renderizar a foto de outra pessoa no feed faria o aparelho
-- de quem está lendo abrir conexão com o Google, entregando IP e horário. Como
-- um gatilho SQL não consegue baixar o arquivo para o nosso bucket, o perfil
-- começa com a inicial do nome e a pessoa escolhe a foto quando quiser.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name text;
begin
  v_name := nullif(btrim(coalesce(
    v_meta->>'display_name',
    v_meta->>'full_name',
    v_meta->>'name',
    ''
  )), '');

  insert into public.profiles (id, display_name)
  values (new.id, coalesce(v_name, split_part(new.email, '@', 1), 'Estudante'))
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Desfaz o preenchimento de foto externa, caso alguma versão anterior desta
-- migração tenha gravado uma URL de fora do nosso storage.
update public.profiles
set avatar_url = null
where avatar_url is not null
  and avatar_url not like '%/storage/v1/object/public/%';
