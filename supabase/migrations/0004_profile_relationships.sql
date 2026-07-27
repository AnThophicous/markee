-- Permite ao PostgREST embutir o perfil do autor nas consultas.
--
-- As colunas de usuário apontavam só para auth.users, que fica fora do schema
-- exposto pela API. Sem uma FK para public.profiles, um select como
--   messages?select=content,profiles(display_name)
-- falha com PGRST200 ("Could not find a relationship"), e a lista de membros e
-- o chat ficariam sem nome nem avatar.
--
-- A FK extra é segura: profiles.id referencia auth.users(id) e o gatilho
-- handle_new_user garante um perfil para todo usuário criado.

alter table public.group_members
  add constraint group_members_user_profile_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.messages
  add constraint messages_author_profile_fkey
  foreign key (author_id) references public.profiles(id) on delete cascade;

alter table public.posts
  add constraint posts_author_profile_fkey
  foreign key (author_id) references public.profiles(id) on delete cascade;

alter table public.post_comments
  add constraint post_comments_author_profile_fkey
  foreign key (author_id) references public.profiles(id) on delete cascade;

alter table public.study_materials
  add constraint study_materials_uploader_profile_fkey
  foreign key (uploaded_by) references public.profiles(id) on delete cascade;
