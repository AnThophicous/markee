-- ===========================================================================
-- Transcrição: modelo e limite saem do plano, no servidor.
--
-- Duas decisões moram aqui, e nenhuma pode morar no aplicativo:
--
--   1. QUAL MODELO. Se o app mandasse o nome do modelo, um APK modificado
--      pediria o caro numa conta grátis — e quem paga a diferença é o dono da
--      chave da OpenAI, não quem modificou. O plano escolhe.
--
--   2. QUANTO CABE. A cota já é debitada por função SECURITY DEFINER com trava
--      de linha. Conferência no cliente seria decoração: bastaria chamar a
--      função de borda direto.
--
-- Modelo como COLUNA, e não como `case` dentro de uma função: criar um nível
-- novo de assinatura passa a ser um INSERT nesta tabela, sem tocar em código
-- nem publicar função de borda de novo. Trocar o modelo de um plano é um
-- UPDATE, e vale na chamada seguinte.
-- ===========================================================================

alter table public.plans
  add column if not exists transcribe_model text;

comment on column public.plans.transcribe_model is
  'Modelo de transcrição da OpenAI que este plano usa. Lido pela função de '
  'borda; o aplicativo nunca escolhe.';

/**
 * Limites e modelos.
 *
 * Os números vêm da conta, não do palpite. Em julho de 2026 a OpenAI cobra
 * US$ 0,006/min pelo gpt-4o-transcribe e US$ 0,003/min pelo mini.
 *
 *   grátis  15 min x 0,003 = US$ 0,045 por pessoa que talvez nunca pague nada.
 *   pro    300 min x 0,006 = US$ 1,80  contra R$ 9,90 (~US$ 1,80) de receita.
 *
 * O Pro no limite consome a receita inteira em transcrição, sem sobrar para os
 * pedidos de IA. Está registrado aqui de propósito: se um dia a margem
 * apertar, o conserto é UPDATE nesta tabela — baixar para 150 minutos devolve
 * metade, e trocar o modelo pelo mini devolve a outra metade.
 */
update public.plans set
  transcribe_min_month = 15,
  transcribe_model     = 'gpt-4o-mini-transcribe'
where id = 'free';

update public.plans set
  transcribe_min_month = 300,
  transcribe_model     = 'gpt-4o-transcribe'
where id = 'pro';

-- Plano sem modelo não pode existir: a função de borda não teria o que chamar,
-- e o erro apareceria só quando alguém tentasse transcrever.
alter table public.plans
  alter column transcribe_model set not null;

/**
 * O que a função de borda precisa saber antes de chamar a OpenAI.
 *
 * Uma chamada só em vez de três: o plano, o modelo, o teto do mês e quanto já
 * foi gasto. SECURITY DEFINER porque `plans` não é legível por quem usa o app —
 * e não precisa ser: o app mostra "300 minutos", não o nome do modelo.
 */
create or replace function public.my_transcribe_config()
returns table (plan text, model text, min_limit int, min_used int)
language sql stable security definer set search_path = public as $$
  select
    p.id,
    p.transcribe_model,
    p.transcribe_min_month,
    public.usage_this_month(auth.uid(), 'transcribe_minute')
  from public.plans p
  where p.id = public.current_plan(auth.uid());
$$;

revoke all on function public.my_transcribe_config() from public, anon;
-- Só a função de borda usa, com o token de quem chamou. Fica liberada para
-- `authenticated` porque é assim que ela chega lá — mas não devolve nada de
-- ninguém além de quem está autenticado.
grant execute on function public.my_transcribe_config() to authenticated;
