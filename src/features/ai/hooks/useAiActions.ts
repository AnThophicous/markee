import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useSettingsStore } from '@/features/settings/store/useSettingsStore';
import { runAgent } from '../services/agent';
import {
  completeRaw,
  runAiAction,
  usesOwnKey,
  type AiAction,
  type AiOutcome,
} from '../services/openrouter.service';
import type { ToolTrace } from '../tools/types';

export type { AiAction, AiOutcome };
export { usesOwnKey };

/** Traduz o erro cru de cota do banco numa frase útil. */
export function describeQuotaError(message: string): string | null {
  const match = message.match(/QUOTA_EXCEEDED:(\w+):(\d+):(\d+)/);
  if (!match) return null;

  const [, kind, , limit] = match;
  return kind === 'ai_call'
    ? `Você usou seus ${limit} pedidos de IA deste mês. O Pro sobe para 500 — ou configure a sua própria chave, que não tem limite.`
    : `Você usou seus ${limit} minutos deste mês.`;
}

export type AiResultWithTraces = AiOutcome & { traces?: ToolTrace[] };

/**
 * A cota é aplicada no SERVIDOR, dentro da Edge Function, antes de falar com a
 * OpenRouter. Debitar aqui no aplicativo não valeria nada: bastaria editar o
 * app e pular a linha. E quem usa a própria chave não passa pelo nosso
 * servidor, então não tem limite nenhum — os tokens são pagos por essa pessoa.
 */
export function useAiAction() {
  const allowNotes = useSettingsStore((state) => state.allowAiNotes);
  const queryClient = useQueryClient();

  return useMutation<AiResultWithTraces, Error, { action: AiAction; content: string }>({
    mutationFn: async ({ action, content }) => {
      if (!content.trim()) {
        throw new Error('Escreva algo antes de usar a IA.');
      }

      // "Perguntar" é a única ação com ferramentas: as outras trabalham sobre o
      // texto que já está na tela e não têm o que pesquisar.
      if (action === 'ask') {
        const { text, traces } = await runAgent(content, {
          complete: (prompt) => completeRaw(prompt, 1600),
          allowNotes,
        });
        return { kind: 'text', action, text, traces };
      }

      return runAiAction(action, content);
    },
    onSettled: () => {
      // O contador do plano muda a cada pedido feito pela nossa conta.
      if (!usesOwnKey()) queryClient.invalidateQueries({ queryKey: ['usage'] });
    },
  });
}
