-- Habilita o realtime nas tabelas do chat e do feed.
--
-- Sem estar na publicação `supabase_realtime`, o Postgres não emite os eventos
-- e o `postgres_changes` do cliente nunca dispara — o chat só atualizaria ao
-- recarregar a tela. O RLS continua valendo: cada assinante só recebe eventos
-- das linhas que teria permissão de ler.

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.post_comments;

-- REPLICA IDENTITY FULL faz o payload de UPDATE/DELETE trazer a linha antiga,
-- necessário para o cliente saber qual mensagem sumiu.
alter table public.messages replica identity full;
alter table public.posts replica identity full;
alter table public.post_comments replica identity full;
