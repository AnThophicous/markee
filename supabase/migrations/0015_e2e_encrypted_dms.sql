-- Conversas entre amigos com criptografia ponta a ponta.
--
-- O servidor passa a guardar só bytes embaralhados: `content` vira o texto
-- cifrado em base64 e `nonce` guarda o número usado uma vez. A chave privada
-- nunca sai do aparelho, então nem com acesso total ao banco dá para ler.
--
-- `encrypted` existe porque as mensagens que já estavam gravadas são texto puro.
-- Sem a marca, o app tentaria decifrar texto comum e mostraria lixo.

alter table public.profiles
  add column if not exists public_key text;

alter table public.dm_messages
  add column if not exists nonce     text,
  add column if not exists encrypted boolean not null default false;

/**
 * Só a própria pessoa publica a sua chave pública, e ela é obrigatória para
 * cifrar. Fica em `profiles`, que já é legível por qualquer autenticado — a
 * chave PÚBLICA ser pública é o ponto dela.
 */
create or replace function public.set_public_key(p_key text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Você precisa estar logado.';
  end if;
  if p_key is null or length(btrim(p_key)) < 40 then
    raise exception 'Chave pública inválida.';
  end if;

  update public.profiles set public_key = btrim(p_key) where id = auth.uid();
end;
$$;

revoke all on function public.set_public_key(text) from public, anon;
grant execute on function public.set_public_key(text) to authenticated;

/**
 * Mensagem cifrada precisa vir com nonce. Sem esta trava, um cliente com defeito
 * gravaria `encrypted = true` sem o nonce e a conversa ficaria ilegível para
 * sempre — inclusive para quem escreveu.
 */
do $$ begin
  alter table public.dm_messages
    add constraint dm_messages_nonce_check
    check (not encrypted or nonce is not null);
exception when duplicate_object then null;
end $$;
