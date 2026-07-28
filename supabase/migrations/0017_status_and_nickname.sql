-- ===========================================================================
-- Status personalizado no perfil e apelido por grupo.
--
-- As duas coisas são VISÍVEIS PARA OUTRAS PESSOAS, então a validação mora aqui
-- e não no aplicativo. Um app modificado consegue mandar qualquer coisa para o
-- servidor; o que ele não consegue é escapar de um gatilho. Essa é a linha que
-- separa o que alguém pode fazer no próprio aparelho do que consegue impor aos
-- outros.
-- ===========================================================================

-- ------------------------------------------------------- 1. STATUS DO PERFIL

alter table public.profiles
  add column if not exists status_text  text,
  add column if not exists status_emoji text,
  add column if not exists status_until timestamptz;

comment on column public.profiles.status_until is
  'Quando o status deixa de valer. Nulo = não expira. Quem lê compara com o '
  'horário atual; não existe tarefa apagando isso, e não precisa existir.';

/**
 * Gatilho SEPARADO do de personalização, de propósito.
 *
 * O `validate_profile_customization` valida o tema e cobra Pro por gradiente,
 * efeito e banner. Se o status entrasse lá, alguém que assinou, escolheu um
 * gradiente e depois deixou de ser Pro ficaria impedido de trocar o próprio
 * status — o gatilho reprovaria por causa do tema antigo, numa gravação que não
 * tem nada a ver com tema. Separado, cada um responde só pelo que é seu.
 *
 * Status é de graça. É justamente o tipo de coisa que faz as pessoas voltarem ao
 * app, e cobrar por ele renderia pouco e afastaria mais.
 */
create or replace function public.validate_profile_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if length(coalesce(new.status_text, '')) > 60 then
    raise exception 'O status precisa ter no máximo 60 caracteres.';
  end if;

  -- Emoji com sequência ZWJ (família, profissões) chega a sete pontos de
  -- código, daí o limite não ser 1 ou 2. O teto existe para o campo não virar
  -- uma segunda linha de texto contornando o limite acima.
  if length(coalesce(new.status_emoji, '')) > 12 then
    raise exception 'Escolha um emoji só.';
  end if;

  -- Sem letras nem números: é campo de emoji, não de texto.
  if new.status_emoji is not null and new.status_emoji ~ '[a-zA-Z0-9]' then
    raise exception 'O campo do emoji aceita apenas emoji.';
  end if;

  -- Data no passado deixaria o status nascer já vencido, que é o mesmo que
  -- não aparecer — e a pessoa acharia que o app engoliu o que ela escreveu.
  if new.status_until is not null and new.status_until <= now() then
    raise exception 'A validade do status precisa estar no futuro.';
  end if;

  -- Emoji sem texto é um status válido; texto vazio com espaços, não.
  if new.status_text is not null and btrim(new.status_text) = '' then
    new.status_text := null;
  end if;

  return new;
end;
$$;

drop trigger if exists on_profile_status on public.profiles;
create trigger on_profile_status
  before insert or update of status_text, status_emoji, status_until on public.profiles
  for each row execute function public.validate_profile_status();

-- ------------------------------------------------------ 2. APELIDO POR GRUPO

/**
 * A coluna `group_members.nickname` já existia desde o começo, mas não havia
 * caminho para preenchê-la: nenhuma tela e nenhuma função. Ficou um campo morto.
 *
 * Vai por função, e não por UPDATE direto, porque a política de RLS de
 * group_members precisaria liberar UPDATE na linha — e liberar UPDATE na linha
 * inteira deixaria a pessoa trocar o PRÓPRIO `role_id`, isto é, se promover a
 * administradora do grupo. A função altera só o apelido e nada mais.
 */
create or replace function public.set_nickname(p_group_id uuid, p_nickname text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_limpo text := nullif(btrim(coalesce(p_nickname, '')), '');
begin
  if length(coalesce(v_limpo, '')) > 32 then
    raise exception 'O apelido precisa ter no máximo 32 caracteres.';
  end if;

  update public.group_members
     set nickname = v_limpo
   where group_id = p_group_id
     and user_id  = auth.uid();

  -- Sem linha afetada, ou a pessoa não está no grupo ou o grupo não existe.
  -- Um UPDATE que não acha ninguém não é erro em SQL, então o silêncio aqui
  -- seria indistinguível de sucesso.
  if not found then
    raise exception 'Você não faz parte deste grupo.';
  end if;
end;
$$;

revoke all on function public.set_nickname(uuid, text) from public;
grant execute on function public.set_nickname(uuid, text) to authenticated;
