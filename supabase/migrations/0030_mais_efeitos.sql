-- Seis efeitos novos de decoração, e a foto animada dita por escrito.
--
-- A lista de efeitos válidos vive no banco porque é ela que decide o que entra
-- na coluna. Conferir só no aplicativo seria decoração: um POST direto na API
-- grava o que quiser, e um efeito desconhecido chegando na tela cai em 'none'
-- em silêncio — a pessoa salvaria, não veria erro, e o enfeite simplesmente não
-- apareceria para ninguém.
--
-- Todos os novos são Pro, como os seis que já existiam. A validação de plano
-- não muda: ela olha `effect <> 'none'`, então basta a whitelist crescer.

create or replace function public.is_valid_effect(p_effect text)
returns boolean language sql immutable as $$
  select p_effect in (
    'none',
    -- os que já existiam
    'shine', 'glow', 'sweep', 'pulse', 'shift', 'spin',
    -- os novos
    'aurora', 'holo', 'neon', 'ondas', 'metal', 'veludo'
  );
$$;

/**
 * A foto animada do Pro: onde o conserto fica, e onde ele NÃO fica.
 *
 * O gatilho já recusava GIF de conta grátis (PRO_REQUIRED:animated_icon) desde
 * a 0014 — essa parte estava certa. O defeito era do outro lado: o seletor de
 * imagem do aplicativo recortava a foto antes de enviar, e recortar reescreve
 * o arquivo. A animação morria no caminho e chegava aqui um quadro parado. Quem
 * pagava pelo Pro recebia uma foto estática e nenhuma explicação de por quê.
 *
 * O conserto é no cliente: escolher sem recorte e com qualidade 1. Não há nada
 * a fazer no banco por isso, e vale registrar o limite com honestidade —
 * `allowed_mime_types` confere o Content-Type DECLARADO no envio, nunca os
 * bytes. Um arquivo qualquer anunciado como `image/gif` entra.
 *
 * O que sobra de defesa, e por que dá para viver com isso: o bucket aceita no
 * máximo 8 MB, o caminho é obrigatoriamente a pasta de quem enviou (0016), e o
 * arquivo é servido como imagem. Ou seja, o pior caso é alguém guardar lixo na
 * própria pasta. O aplicativo confere os bytes antes de enviar — o que resolve
 * o caso comum, que é um arquivo mal renomeado, e não o caso de má-fé.
 */
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id in ('avatars', 'group-assets', 'uploads');
