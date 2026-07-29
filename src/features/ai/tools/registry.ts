import { supabase } from '@/services/supabase';
import { calculate } from './calculator';
import { dateTool } from './datetime';
import { readNotesTool } from './notes';
import {
  descrever,
  proporCartas,
  proporLembrete,
  proporReorganizacao,
  proporSecao,
  proporTags,
  proporTitulo,
} from './notas-escrita';
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
 * As ferramentas.
 *
 * As descrições aqui não são documentação: elas vão inteiras dentro do prompt e
 * são o que ensina o modelo a escolher a ferramenta certa. Texto vago aqui vira
 * ferramenta usada na hora errada.
 *
 * As quatro primeiras LEEM. As seis últimas MEXEM na nota, e nenhuma delas
 * aplica coisa alguma: devolvem uma mudança proposta que a pessoa aprova com um
 * toque. O `run` delas nem chega a ser chamado — está ali porque o tipo pede, e
 * porque um dia alguém vai remover o `propoe` sem perceber, e é melhor que
 * nesse dia a ferramenta diga que não fez nada do que escreva sozinha.
 */

const NAO_APLICA = async () =>
  'Esta ferramenta apenas propõe. A mudança foi mostrada ao usuário para aprovação.';
const LEITURA: Tool[] = [
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

const ESCRITA: Tool[] = [
  {
    name: 'renomear',
    description:
      'Propõe um título novo para a nota aberta. Use quando o usuário pedir um título, ou quando a ' +
      'nota estiver sem título e ele pedir para organizar.',
    argumentHint: 'Respiração celular',
    needsPermission: 'notes',
    run: NAO_APLICA,
    propoe: (argumento) => proporTitulo(argumento),
  },
  {
    name: 'marcar_tag',
    description:
      'Propõe tags para a nota aberta. Uma palavra por tag, separadas por vírgula. Use quando o ' +
      'usuário pedir para etiquetar, classificar ou organizar a nota.',
    argumentHint: 'biologia, prova, celula',
    needsPermission: 'notes',
    run: NAO_APLICA,
    propoe: proporTags,
  },
  {
    name: 'criar_secao',
    description:
      'Propõe acrescentar uma seção ao fim da nota. Formato: titulo | corpo da seção. Use para ' +
      'resumo, conclusão, lista de exercícios ou qualquer bloco novo que o usuário pedir.',
    argumentHint: 'Resumo | A célula tem três partes principais...',
    needsPermission: 'notes',
    run: NAO_APLICA,
    propoe: (argumento) => proporSecao(argumento),
  },
  {
    name: 'criar_lembrete',
    description:
      'Propõe um lembrete para a nota aberta. Formato: data | texto. Prefira data ISO ' +
      '(AAAA-MM-DD HH:MM). Use quando houver prova, entrega ou prazo.',
    argumentHint: '2026-08-12 19:00 | Prova de biologia',
    needsPermission: 'notes',
    run: NAO_APLICA,
    propoe: proporLembrete,
  },
  {
    name: 'criar_cartas',
    description:
      'Propõe cartas de revisão espaçada a partir da nota. Uma por linha, no formato ' +
      'pergunta | resposta. Use quando o usuário pedir para estudar, decorar ou revisar.',
    argumentHint: 'Mitocôndria | organela da respiração celular',
    needsPermission: 'notes',
    run: NAO_APLICA,
    propoe: (argumento) => proporCartas(argumento),
  },
  {
    name: 'reorganizar',
    description:
      'Propõe reescrever a nota inteira organizada em seções, SEM tirar nada do conteúdo. ' +
      'Devolva o texto completo em markdown. Use só quando o usuário pedir para organizar ou ' +
      'estruturar a nota toda.',
    argumentHint: '## Introdução\n...\n## Desenvolvimento\n...',
    needsPermission: 'notes',
    run: NAO_APLICA,
    propoe: proporReorganizacao,
  },
];

export const TOOLS: Tool[] = [...LEITURA, ...ESCRITA];

/** O texto que volta para o modelo depois de uma proposta aceita pelo parser. */
export const descreverProposta = descrever;

export function findTool(name: string): Tool | undefined {
  return TOOLS.find((tool) => tool.name === name.trim().toLowerCase());
}
