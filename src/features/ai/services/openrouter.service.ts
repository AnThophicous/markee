import { supabase } from '@/services/supabase';
import { storage } from '@/storage/mmkv';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const API_KEY_STORAGE_KEY = 'markee.openrouter.apiKey';

/**
 * The free router picks a different underlying model on every call — including,
 * occasionally, a content-safety classifier that returns no usable text. Every
 * request therefore needs a generous token budget and a retry.
 */
export const FREE_MODEL = 'openrouter/free';
const MIN_TOKENS = 800;
const MAX_ATTEMPTS = 3;

export function getApiKey(): string | null {
  return storage.getString(API_KEY_STORAGE_KEY) ?? null;
}

export function setApiKey(key: string): void {
  storage.set(API_KEY_STORAGE_KEY, key.trim());
}

export function clearApiKey(): void {
  storage.remove(API_KEY_STORAGE_KEY);
}

export class MissingApiKeyError extends Error {
  constructor() {
    super('A IA ainda não está ligada no servidor. Configure sua chave da OpenRouter em Configurações.');
    this.name = 'MissingApiKeyError';
  }
}

/** Com chave própria não há limite nosso: os tokens são pagos por quem a configurou. */
export function usesOwnKey(): boolean {
  return Boolean(getApiKey());
}

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type CompletionResponse = {
  model?: string;
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
  error?: { message?: string };
};

/**
 * Duas rotas, e a diferença muda quem paga a conta:
 *
 *   1. Chave própria em Configurações → chamada direta à OpenRouter, SEM cota.
 *      Os tokens saem do bolso de quem configurou; limitar isso seria cobrar
 *      para atrapalhar.
 *   2. Sem chave própria → passa pelo nosso servidor, que usa a NOSSA chave e
 *      aí sim debita a cota do plano. É o custo que o Pro cobre.
 */
async function requestCompletion(messages: ChatMessage[], maxTokens: number): Promise<string> {
  return getApiKey() ? requestDirect(messages, maxTokens) : requestViaServer(messages, maxTokens);
}

/** Caminho com a chave da própria pessoa. Sem limite nosso. */
async function requestDirect(messages: ChatMessage[], maxTokens: number): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new MissingApiKeyError();

  let lastError = 'A IA não retornou uma resposta.';

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'Markee',
      },
      body: JSON.stringify({
        model: FREE_MODEL,
        messages,
        max_tokens: Math.max(maxTokens, MIN_TOKENS),
      }),
    });

    if (response.status === 401) {
      throw new Error('Chave da OpenRouter inválida ou expirada.');
    }
    if (response.status === 429) {
      lastError = 'Limite de uso gratuito atingido. Tente novamente mais tarde.';
      continue;
    }

    const payload = (await response.json()) as CompletionResponse;
    if (payload.error?.message) {
      lastError = payload.error.message;
      continue;
    }

    const content = payload.choices?.[0]?.message?.content;
    if (content && content.trim()) return content.trim();

    // O roteador caiu num modelo que não produziu texto — tentar de novo cai
    // em outro.
    lastError = 'A IA não retornou uma resposta. Tente novamente.';
  }

  throw new Error(lastError);
}

/** Caminho pelo nosso servidor: a chave é nossa e a cota do plano vale. */
async function requestViaServer(messages: ChatMessage[], maxTokens: number): Promise<string> {
  const system = messages.find((message) => message.role === 'system')?.content;
  const prompt = messages.filter((message) => message.role === 'user').map((m) => m.content).join('\n\n');

  let lastError = 'A IA não retornou uma resposta.';

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const { data, error } = await supabase.functions.invoke<{ content?: string; error?: string }>('ai', {
      body: { system, prompt, maxTokens: Math.max(maxTokens, MIN_TOKENS) },
    });

    if (data?.content) return data.content.trim();

    const message = data?.error ?? error?.message ?? lastError;

    // Cota estourada não se resolve tentando de novo.
    if (message.includes('QUOTA_EXCEEDED')) throw new Error(message);
    if (message.includes('não configurada')) throw new MissingApiKeyError();

    lastError = message;
  }

  throw new Error(lastError);
}

/** Free models often wrap JSON in markdown fences or add prose around it. */
export function extractJson<T>(raw: string): T {
  const withoutFences = raw.replace(/```(?:json)?/gi, '').trim();

  const candidates = [withoutFences];
  const firstArray = withoutFences.indexOf('[');
  const lastArray = withoutFences.lastIndexOf(']');
  if (firstArray !== -1 && lastArray > firstArray) {
    candidates.push(withoutFences.slice(firstArray, lastArray + 1));
  }
  const firstObject = withoutFences.indexOf('{');
  const lastObject = withoutFences.lastIndexOf('}');
  if (firstObject !== -1 && lastObject > firstObject) {
    candidates.push(withoutFences.slice(firstObject, lastObject + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // try the next candidate
    }
  }

  throw new Error('A IA respondeu num formato inesperado. Tente novamente.');
}


/* ------------------------------------------------------------------ ações */

export type AiAction =
  | 'ask'
  | 'summarize'
  | 'explain'
  | 'flashcards'
  | 'quiz'
  | 'improve'
  | 'outline'
  | 'studyPlan'
  | 'title'
  | 'continue'
  | 'translate';

type ActionSpec = {
  label: string;
  hint: string;
  icon: string;
  system: string;
  prompt: (content: string) => string;
  maxTokens: number;
  /** Cabeçalho usado quando o resultado é inserido de volta na nota. */
  heading: string | null;
  json?: boolean;
};

const WRITE_IN_PTBR = 'Escreva em português do Brasil.';

export const AI_ACTIONS: Record<AiAction, ActionSpec> = {
  ask: {
    label: 'Perguntar',
    hint: 'Pesquisa na web, calcula e lê suas notas',
    icon: 'message-circle',
    system: '',
    prompt: (content) => content,
    maxTokens: 1600,
    heading: '## Resposta',
  },
  summarize: {
    label: 'Resumir',
    hint: 'Os pontos principais em tópicos curtos',
    icon: 'align-left',
    system: `Você resume notas de estudo. Seja direto e preserve os termos técnicos. ${WRITE_IN_PTBR} Responda apenas com o resumo.`,
    prompt: (content) => `Resuma esta nota em até 5 tópicos curtos:\n\n${content}`,
    maxTokens: 900,
    heading: '## Resumo',
  },
  explain: {
    label: 'Explicar',
    hint: 'Como um professor paciente explicaria',
    icon: 'help-circle',
    system: `Você explica conteúdo de estudo de forma simples e curta, como um professor paciente. ${WRITE_IN_PTBR} Responda apenas com a explicação.`,
    prompt: (content) => `Explique este trecho:\n\n${content}`,
    maxTokens: 900,
    heading: '## Explicação',
  },
  flashcards: {
    label: 'Flashcards',
    hint: 'Perguntas e respostas para revisar',
    icon: 'layers',
    system: `Você gera flashcards de estudo. ${WRITE_IN_PTBR} Responda SOMENTE com JSON válido, sem markdown e sem comentários.`,
    prompt: (content) =>
      `Gere 5 flashcards a partir do conteúdo abaixo, no formato [{"pergunta":"...","resposta":"..."}]\n\n${content}`,
    maxTokens: 1400,
    heading: '## Flashcards',
    json: true,
  },
  quiz: {
    label: 'Simulado',
    hint: 'Questões de múltipla escolha com gabarito',
    icon: 'check-square',
    system: `Você cria questões de múltipla escolha no estilo de prova. ${WRITE_IN_PTBR} Responda SOMENTE com JSON válido, sem markdown.`,
    prompt: (content) =>
      'Crie 5 questões de múltipla escolha (4 alternativas cada) sobre o conteúdo abaixo, no formato ' +
      '[{"pergunta":"...","alternativas":["a","b","c","d"],"correta":0,"porque":"..."}]. ' +
      `O campo "correta" é o índice da alternativa certa.\n\n${content}`,
    maxTokens: 1800,
    heading: '## Simulado',
    json: true,
  },
  improve: {
    label: 'Melhorar a escrita',
    hint: 'Mesma ideia, texto mais claro',
    icon: 'edit-3',
    system: `Você revisa textos de estudo: corrige erros, melhora a clareza e mantém o sentido e o tom originais. ${WRITE_IN_PTBR} Responda apenas com o texto revisado, sem comentários.`,
    prompt: (content) => `Revise e melhore este texto sem mudar o sentido:\n\n${content}`,
    maxTokens: 1600,
    heading: null,
  },
  outline: {
    label: 'Organizar em tópicos',
    hint: 'Vira uma estrutura hierárquica',
    icon: 'list',
    system: `Você organiza conteúdo de estudo numa estrutura hierárquica de tópicos em Markdown, usando cabeçalhos e listas. ${WRITE_IN_PTBR} Responda apenas com a estrutura.`,
    prompt: (content) => `Organize este conteúdo numa estrutura de tópicos em Markdown:\n\n${content}`,
    maxTokens: 1400,
    heading: '## Estrutura',
  },
  studyPlan: {
    label: 'Plano de estudos',
    hint: 'Um cronograma a partir da nota',
    icon: 'calendar',
    system: `Você monta planos de estudo realistas em Markdown, com dias e metas concretas. ${WRITE_IN_PTBR} Responda apenas com o plano.`,
    prompt: (content) =>
      `Monte um plano de estudos de 7 dias para dominar o conteúdo abaixo. Use uma lista de tarefas por dia.\n\n${content}`,
    maxTokens: 1600,
    heading: '## Plano de estudos',
  },
  title: {
    label: 'Sugerir título',
    hint: 'Um nome curto para a nota',
    icon: 'type',
    system: `Você cria títulos curtos e descritivos. ${WRITE_IN_PTBR} Responda com um único título, sem aspas e sem pontuação final.`,
    prompt: (content) => `Sugira um título de no máximo 6 palavras para esta nota:\n\n${content.slice(0, 2000)}`,
    maxTokens: 800,
    heading: null,
  },
  continue: {
    label: 'Continuar escrevendo',
    hint: 'A IA segue de onde você parou',
    icon: 'corner-down-right',
    system: `Você continua textos de estudo mantendo o mesmo assunto, tom e formatação. ${WRITE_IN_PTBR} Responda apenas com a continuação, sem repetir o que já foi escrito.`,
    prompt: (content) => `Continue este texto de onde ele parou:\n\n${content.slice(-4000)}`,
    maxTokens: 1200,
    heading: null,
  },
  translate: {
    label: 'Traduzir para inglês',
    hint: 'Útil para artigos e provas',
    icon: 'globe',
    system: 'You translate Brazilian Portuguese study notes into natural English, preserving Markdown formatting. Reply with the translation only.',
    prompt: (content) => `Translate to English:\n\n${content}`,
    maxTokens: 1800,
    heading: '## English',
  },
};

export type GeneratedCard = { pergunta: string; resposta: string };
export type GeneratedQuestion = {
  pergunta: string;
  alternativas: string[];
  correta: number;
  porque?: string;
};

export type AiOutcome =
  | { kind: 'text'; action: AiAction; text: string }
  | { kind: 'cards'; action: AiAction; cards: GeneratedCard[] }
  | { kind: 'quiz'; action: AiAction; questions: GeneratedQuestion[] };

/** Executa a ação escolhida e devolve já no formato que a interface exibe. */
export async function runAiAction(action: AiAction, content: string): Promise<AiOutcome> {
  const spec = AI_ACTIONS[action];
  const raw = await requestCompletion(
    [
      { role: 'system', content: spec.system },
      { role: 'user', content: spec.prompt(content) },
    ],
    spec.maxTokens
  );

  if (action === 'flashcards') {
    const parsed = extractJson<GeneratedCard[]>(raw);
    const cards = (Array.isArray(parsed) ? parsed : [])
      .filter((card) => typeof card?.pergunta === 'string' && typeof card?.resposta === 'string')
      .map((card) => ({ pergunta: card.pergunta.trim(), resposta: card.resposta.trim() }));

    if (cards.length === 0) throw new Error('A IA não conseguiu gerar flashcards. Tente novamente.');
    return { kind: 'cards', action, cards };
  }

  if (action === 'quiz') {
    const parsed = extractJson<GeneratedQuestion[]>(raw);
    const questions = (Array.isArray(parsed) ? parsed : []).filter(
      (question) =>
        typeof question?.pergunta === 'string' &&
        Array.isArray(question?.alternativas) &&
        question.alternativas.length >= 2
    );

    if (questions.length === 0) throw new Error('A IA não conseguiu gerar o simulado. Tente novamente.');
    return { kind: 'quiz', action, questions };
  }

  return { kind: 'text', action, text: raw };
}

/** Markdown pronto para ser colado de volta na nota. */
export function outcomeToMarkdown(outcome: AiOutcome): string {
  const heading = AI_ACTIONS[outcome.action].heading;
  const prefix = heading ? `\n\n${heading}\n\n` : '\n\n';

  if (outcome.kind === 'cards') {
    const cards = outcome.cards.map((card) => `**${card.pergunta}**\n\n${card.resposta}`).join('\n\n---\n\n');
    return `${prefix}${cards}\n`;
  }

  if (outcome.kind === 'quiz') {
    const questions = outcome.questions
      .map((question, index) => {
        const alternatives = question.alternativas
          .map((alternative, i) => `${String.fromCharCode(97 + i)}) ${alternative}`)
          .join('\n');
        const answer = question.alternativas[question.correta] ?? question.alternativas[0];
        return `**${index + 1}. ${question.pergunta}**\n\n${alternatives}\n\n> Resposta: ${answer}${
          question.porque ? ` — ${question.porque}` : ''
        }`;
      })
      .join('\n\n');
    return `${prefix}${questions}\n`;
  }

  return `${prefix}${outcome.text}\n`;
}

/** Chamada crua do modelo, usada pelo laço de ferramentas. */
export async function completeRaw(prompt: string, maxTokens = 1200): Promise<string> {
  return requestCompletion([{ role: 'user', content: prompt }], maxTokens);
}
