import { supabase } from '@/services/supabase';
import { calculate } from './calculator';
import { dateTool } from './datetime';
import { readNotesTool } from './notes';
import type { Tool } from './types';

/** Busca na web — a chamada sai pelo nosso servidor, não pelo aparelho. */
async function searchTool(query: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ content?: string; error?: string }>('search', {
    body: { query },
  });

  if (data?.content) return data.content;
  return `A busca falhou: ${data?.error ?? error?.message ?? 'sem resposta'}.`;
}

/**
 * As quatro ferramentas.
 *
 * As descrições aqui não são documentação: elas vão inteiras dentro do prompt e
 * são o que ensina o modelo a escolher a ferramenta certa. Texto vago aqui vira
 * ferramenta usada na hora errada.
 */
export const TOOLS: Tool[] = [
  {
    name: 'buscar',
    description:
      'Pesquisa na internet. Use SEMPRE que a pergunta depender de fato recente, número, notícia, ' +
      'lei, data de vestibular, ou qualquer coisa que você não tenha certeza. Não invente: busque.',
    argumentHint: 'o que pesquisar, em poucas palavras',
    run: searchTool,
  },
  {
    name: 'calcular',
    description:
      'Faz contas exatas. Use para qualquer conta com mais de dois números, porcentagem, média, ' +
      'raiz ou potência — errar conta de cabeça é comum.',
    argumentHint: '(8.5 + 7.2 + 9.1) / 3',
    run: async (argument) => {
      try {
        return `${argument} = ${calculate(argument)}`;
      } catch (e) {
        return `Não consegui calcular: ${e instanceof Error ? e.message : 'expressão inválida'}`;
      }
    },
  },
  {
    name: 'minhas_notas',
    description:
      'Procura nas notas do próprio usuário. Use quando ele disser "minhas notas", "o que eu anotei", ' +
      '"na minha nota de biologia" ou pedir algo que só está no caderno dele.',
    argumentHint: 'termo a procurar, como "fotossíntese"',
    needsPermission: 'notes',
    run: readNotesTool,
  },
  {
    name: 'data',
    description:
      'Diz que dia é hoje e calcula quantos dias faltam para uma data. Use sempre que a pergunta ' +
      'envolver prazo, "quantos dias", "quando", ou a data de hoje — você não sabe a data atual.',
    argumentHint: 'vazio para hoje, ou uma data como 15/12/2026',
    run: dateTool,
  },
];

export function findTool(name: string): Tool | undefined {
  return TOOLS.find((tool) => tool.name === name.trim().toLowerCase());
}
