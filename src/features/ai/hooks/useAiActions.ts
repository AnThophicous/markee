import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/services/supabase';
import { runAiAction, type AiAction, type AiOutcome } from '../services/openrouter.service';

export type { AiAction, AiOutcome };

/** Traduz o erro cru de cota do banco numa frase útil. */
export function describeQuotaError(message: string): string | null {
  const match = message.match(/QUOTA_EXCEEDED:(\w+):(\d+):(\d+)/);
  if (!match) return null;

  const [, kind, , limit] = match;
  return kind === 'ai_call'
    ? `Você usou seus ${limit} pedidos de IA deste mês. O Pro sobe para 500.`
    : `Você usou seus ${limit} minutos de transcrição deste mês.`;
}

/**
 * O uso é registrado no servidor ANTES da chamada à IA — registrar depois
 * abriria a porta para não contar nada: bastaria matar o app enquanto a
 * resposta chega.
 *
 * Hoje isso só CONTA (record_usage), não barra. A chave da OpenRouter é a do
 * próprio usuário, então travar em 20 pedidos por mês não economizaria nada
 * nosso e só atrapalharia. O contador do plano fica verdadeiro desde já, e no
 * dia em que a chamada passar pelo nosso servidor basta trocar esta função por
 * `consume_quota`, que já debita com trava de linha e recusa ao estourar.
 */
async function meterAiUsage(): Promise<void> {
  const { error } = await supabase.rpc('record_usage', { p_kind: 'ai_call', p_amount: 1 });

  // Sem sessão o registro falha; a IA local ainda funciona, então seguimos.
  if (error && !error.message.includes('logado')) {
    throw new Error(describeQuotaError(error.message) ?? error.message);
  }
}

export function useAiAction() {
  const queryClient = useQueryClient();

  return useMutation<AiOutcome, Error, { action: AiAction; content: string }>({
    mutationFn: async ({ action, content }) => {
      if (!content.trim()) {
        throw new Error('Escreva algo na nota antes de usar a IA.');
      }

      await meterAiUsage();
      return runAiAction(action, content);
    },
    onSettled: () => {
      // O contador do plano muda a cada pedido, dando certo ou não.
      queryClient.invalidateQueries({ queryKey: ['usage'] });
    },
  });
}
