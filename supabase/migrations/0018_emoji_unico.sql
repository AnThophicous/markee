-- ===========================================================================
-- Conserta o "escolha um emoji só" da 0017.
--
-- A 0017 limitava o campo a 12 caracteres. O limite era alto de propósito: um
-- emoji de família tem SETE pontos de código — quatro pessoas e três juntadores
-- —, então limitar a 1 ou 2 recusaria emoji legítimo.
--
-- Só que 12 caracteres também cabem doze emoji separados. O teste contra o
-- banco real mandou dez emoji de fogo e o gatilho aceitou. Ou seja: o campo de
-- emoji virava uma segunda linha de texto ao lado do status, que é exatamente
-- o que ele deveria impedir.
--
-- A correção troca "quantos caracteres" por "quantos emoji", que é o que se
-- queria medir desde o começo.
-- ===========================================================================

/**
 * Quantos emoji há no texto.
 *
 * Não existe contagem de grafemas no Postgres, então isto desmonta as três
 * formas de um emoji ocupar mais de um ponto de código e conta o que sobra:
 *
 *   1. MODIFICADORES — seletor de variação (o que transforma o coração preto no
 *      vermelho), tom de pele, o círculo de keycap e as tags usadas nas
 *      bandeiras regionais. São enfeites presos ao caractere anterior; somem.
 *
 *   2. BANDEIRAS — a do Brasil é um par de indicadores regionais. O par colapsa
 *      em um.
 *
 *   3. JUNTADOR (ZWJ, U+200D) — é o que cola homem + mulher + menina + menino
 *      num emoji de família só. Remover "juntador seguido de um caractere"
 *      apaga cada pedaço colado e deixa apenas o primeiro. Precisa vir DEPOIS
 *      do passo 1: se o juntador for removido junto com os modificadores, não
 *      sobra nada para casar aqui e a família volta a contar como quatro. Foi
 *      esse o erro na primeira tentativa de escrever isto.
 *
 * Os códigos vão escritos como \U com oito dígitos de propósito. FE0F, 200D e
 * companhia são caracteres invisíveis: escritos direto, o arquivo teria buracos
 * que ninguém enxerga ao revisar e que um copiar-e-colar distraído apaga em
 * silêncio. A forma de oito dígitos vale para todos, inclusive os que caberiam
 * em quatro — misturar as duas seria mais uma coisa para conferir na revisão.
 *
 * IMMUTABLE porque só depende da entrada.
 */
create or replace function public.count_emoji(p_texto text)
returns int language sql immutable set search_path = public as $$
  select length(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          coalesce(p_texto, ''),
          '[\U0000FE0F\U0000FE0E\U0001F3FB-\U0001F3FF\U000020E3\U000E0020-\U000E007F]', '', 'g'),
        '([\U0001F1E6-\U0001F1FF])[\U0001F1E6-\U0001F1FF]', '\1', 'g'),
      '\U0000200D.', '', 'g'));
$$;

comment on function public.count_emoji(text) is
  'Conta emoji, não pontos de código. Ver 0018_emoji_unico.sql.';

create or replace function public.validate_profile_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_emoji text := nullif(btrim(coalesce(new.status_emoji, '')), '');
begin
  if length(coalesce(new.status_text, '')) > 60 then
    raise exception 'O status precisa ter no máximo 60 caracteres.';
  end if;

  -- Emoji sem texto é um status válido; texto vazio com espaços, não.
  if new.status_text is not null and btrim(new.status_text) = '' then
    new.status_text := null;
  end if;

  -- Campo em branco vira nulo, para não existir "status com emoji vazio".
  new.status_emoji := v_emoji;

  if v_emoji is not null then
    -- Teto no texto cru antes de chegar na expressão regular. Não é este o
    -- limite que importa; é só para nenhuma entrada absurda ser processada.
    if length(v_emoji) > 32 then
      raise exception 'Escolha um emoji só.';
    end if;

    -- Sem letras nem números: é campo de emoji, não de texto.
    if v_emoji ~ '[a-zA-Z0-9]' then
      raise exception 'O campo do emoji aceita apenas emoji.';
    end if;

    -- Exatamente um. Zero também é recusado: quer dizer que veio só juntador
    -- ou só modificador, algo que não desenha nada na tela e que a pessoa
    -- veria como o app tendo engolido o que ela escolheu.
    if public.count_emoji(v_emoji) <> 1 then
      raise exception 'Escolha um emoji só.';
    end if;
  end if;

  -- Data no passado deixaria o status nascer já vencido, que é o mesmo que
  -- não aparecer — e a pessoa acharia que o app engoliu o que ela escreveu.
  if new.status_until is not null and new.status_until <= now() then
    raise exception 'A validade do status precisa estar no futuro.';
  end if;

  return new;
end;
$$;
