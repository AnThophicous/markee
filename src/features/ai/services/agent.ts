import { TOOLS, findTool } from '../tools/registry';
import type { AgentStep, ToolTrace } from '../tools/types';

/**
 * Laço de ferramentas da IA.
 *
 * Usa um protocolo em TEXTO, e não a API de `tool_calling` da OpenAI. O motivo
 * é concreto: o roteador `openrouter/free` escolhe um modelo diferente a cada
 * chamada, e boa parte deles não implementa tool calling — a chamada falharia de
 * forma aleatória, dependendo de qual modelo caísse. Pedir um formato de texto
 * funciona com qualquer modelo que saiba seguir instrução.
 *
 * O laço roda no APARELHO, não no servidor, porque a ferramenta de notas lê o
 * SQLite local. O servidor entra só para falar com o modelo e para buscar na
 * web.
 */

const MAX_STEPS = 4;

export type AgentOptions = {
  /** Chama o modelo. Recebe o histórico já montado, devolve o texto cru. */
  complete: (prompt: string) => Promise<string>;
  /** Consentimento para ler as notas; sem ele a ferramenta nem é oferecida. */
  allowNotes: boolean;
  /** Avisa a interface a cada ferramenta usada, para mostrar o progresso. */
  onTrace?: (trace: ToolTrace) => void;
};

function buildSystemPrompt(allowNotes: boolean): string {
  const tools = TOOLS.filter((tool) => tool.needsPermission !== 'notes' || allowNotes);

  const catalog = tools
    .map((tool) => `- ${tool.name}: ${tool.description}\n  argumento: ${tool.argumentHint}`)
    .join('\n');

  return [
    'Você é o assistente do Markee, um app de estudos brasileiro. Responda em português do Brasil.',
    '',
    'Você tem ferramentas. Para usar uma, responda SOMENTE com estas duas linhas:',
    'FERRAMENTA: <nome>',
    'ARGUMENTO: <argumento>',
    '',
    'Quando tiver a resposta final, responda SOMENTE com:',
    'RESPOSTA: <sua resposta>',
    '',
    'Ferramentas disponíveis:',
    catalog,
    '',
    'Regras:',
    '- Uma ferramenta por vez. Espere o resultado antes de decidir o próximo passo.',
    '- Não invente fatos, datas nem números: use a ferramenta.',
    '- Se a ferramenta não ajudar, diga que não encontrou, em vez de chutar.',
    '- Ao usar informação da internet, cite a fonte no final.',
    allowNotes
      ? '- As notas são do próprio usuário; ele já autorizou a leitura.'
      : '- Você NÃO tem acesso às notas do usuário. Se ele pedir, diga que precisa liberar o acesso nas Configurações.',
  ].join('\n');
}

/** Lê a decisão do modelo. Sem os marcadores, o texto todo vira a resposta. */
export function parseStep(raw: string): AgentStep {
  const text = raw.trim();

  const tool = text.match(/FERRAMENTA:\s*([a-z_]+)/i);
  if (tool) {
    const argument = text.match(/ARGUMENTO:\s*([\s\S]*?)(?:\n\s*(?:FERRAMENTA|RESPOSTA):|$)/i);
    return { kind: 'tool', tool: tool[1].toLowerCase(), argument: (argument?.[1] ?? '').trim() };
  }

  const answer = text.match(/RESPOSTA:\s*([\s\S]+)/i);
  if (answer) return { kind: 'answer', text: answer[1].trim() };

  // Modelo que ignorou o formato ainda deu uma resposta útil — aproveitamos.
  return { kind: 'answer', text };
}

export type AgentResult = { text: string; traces: ToolTrace[] };

export async function runAgent(question: string, options: AgentOptions): Promise<AgentResult> {
  const traces: ToolTrace[] = [];
  const transcript: string[] = [buildSystemPrompt(options.allowNotes), '', `PERGUNTA: ${question}`];

  for (let step = 0; step < MAX_STEPS; step += 1) {
    const raw = await options.complete(transcript.join('\n'));
    const parsed = parseStep(raw);

    if (parsed.kind === 'answer') {
      return { text: parsed.text, traces };
    }

    const tool = findTool(parsed.tool);

    if (!tool || (tool.needsPermission === 'notes' && !options.allowNotes)) {
      const result = tool
        ? 'O usuário não liberou o acesso às notas.'
        : `Ferramenta "${parsed.tool}" não existe. Use uma das listadas.`;

      transcript.push(`FERRAMENTA: ${parsed.tool}`, `RESULTADO: ${result}`);
      traces.push({ tool: parsed.tool, argument: parsed.argument, result, failed: true });
      continue;
    }

    let result: string;
    try {
      result = await tool.run(parsed.argument);
    } catch (e) {
      result = `A ferramenta falhou: ${e instanceof Error ? e.message : 'erro desconhecido'}`;
    }

    traces.push({ tool: tool.name, argument: parsed.argument, result });
    options.onTrace?.({ tool: tool.name, argument: parsed.argument, result });

    transcript.push(`FERRAMENTA: ${tool.name}`, `ARGUMENTO: ${parsed.argument}`, `RESULTADO: ${result}`);
  }

  /**
   * Estourou os passos. Em vez de devolver vazio, pedimos uma resposta com o
   * que já foi coletado — quase sempre é o suficiente, e é melhor do que "não
   * consegui".
   */
  transcript.push('', 'Você atingiu o limite de ferramentas. Responda agora com o que já tem, começando com RESPOSTA:');
  const last = await options.complete(transcript.join('\n'));
  const parsed = parseStep(last);

  return { text: parsed.kind === 'answer' ? parsed.text : last.trim(), traces };
}
