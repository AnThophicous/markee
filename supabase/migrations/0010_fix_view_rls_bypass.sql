-- CORREÇÃO DE SEGURANÇA — vazamento de posts entre grupos.
--
-- O que acontecia: no Postgres, uma view é executada com os privilégios do
-- DONO dela, não de quem consulta. Como posts_with_counts e
-- poll_options_with_counts foram criadas pelo `postgres`, que também é dono das
-- tabelas, as políticas de RLS de `posts` e `poll_options` simplesmente não
-- eram aplicadas.
--
-- Efeito prático: `select * from posts` devolvia 0 linhas para quem não é do
-- grupo (correto), mas `select * from posts_with_counts` devolvia o post
-- inteiro (errado). E o feed do app lê exclusivamente pela view — ou seja,
-- bastava um GET no PostgREST com o id de um grupo privado para ler tudo.
-- Vale desde a migração 0007.
--
-- security_invoker = on faz a view rodar com o usuário da consulta, e aí o RLS
-- das tabelas de baixo volta a valer.

alter view public.posts_with_counts        set (security_invoker = on);
alter view public.poll_options_with_counts set (security_invoker = on);
