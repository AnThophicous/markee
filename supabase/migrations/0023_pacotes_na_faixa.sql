-- ===========================================================================
-- Pacotes reprecificados para caber na faixa de 15% a 40%.
--
-- A 0020 mirou 30% na cotação de projeto (R$ 6,00). Na cotação real de hoje
-- (R$ 5,09) isso vira 43% a 46% — acima do teto. O `pricing_health` acusou, que
-- é para isso que ele existe.
--
-- UMA COISA QUE NÃO DÁ PARA PROMETER: a faixa não vale para qualquer câmbio.
-- Receita em real e custo em dólar se movem em sentidos opostos, e entre R$ 5 e
-- R$ 7 por dólar a margem oscila uns 18 pontos — mais do que a largura inteira
-- da faixa. O que dá para fazer é escolher o preço que mantém a faixa na JANELA
-- mais provável e deixar o monitor apontar quando sair dela.
--
-- Os preços abaixo ficam dentro de 15%–40% enquanto o dólar estiver entre
-- R$ 5,09 e cerca de R$ 7,50. Fora disso, `pricing_health` avisa e o conserto é
-- um UPDATE aqui.
--
-- Preço resolvido para bater exatamente o teto na cotação de hoje:
--   P = créditos x US$ 0,003 x cotação / (0,85 - 0,40)
-- e depois puxado para baixo nos pacotes maiores, para o desconto por volume
-- existir de verdade sem furar o piso no câmbio ruim.
-- ===========================================================================

update public.credit_packs set price_cents =  339 where id = 'c100';
update public.credit_packs set price_cents =  949 where id = 'c300';
update public.credit_packs set price_cents = 3190 where id = 'c1000';

/**
 * Preço por crédito, para o desconto por volume ser visível na tela em vez de
 * a pessoa ter de dividir de cabeça:
 *   100  -> R$ 0,0339
 *   300  -> R$ 0,0316   (7% mais barato)
 *   1000 -> R$ 0,0319   -- ligeiramente acima do de 300 de propósito: puxar
 *                          mais derrubaria o pacote grande abaixo do piso num
 *                          dólar a R$ 7, e pacote grande é o que mais gente
 *                          compra quando o app engrena.
 */
create or replace function public.pack_unit_price(p_pack text)
returns numeric language sql stable set search_path = public as $$
  select round((price_cents / 100.0) / credits, 4)
    from public.credit_packs where id = p_pack;
$$;
