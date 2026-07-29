import type { ContextoDaNota, MudancaNaNota } from './notas-escrita';

/** Uma ferramenta que a IA pode acionar durante uma resposta. */
export type Tool = {
  name: string;
  /** Descrição que vai no prompt — é ela que ensina o modelo quando usar. */
  description: string;
  /** Exemplo do argumento, também para o prompt. */
  argumentHint: string;
  /**
   * Ferramentas que tocam dados pessoais pedem consentimento explícito antes
   * da primeira execução.
   */
  needsPermission?: 'notes';
  run: (argument: string) => Promise<string>;
  /**
   * Ferramenta que MEXE na nota.
   *
   * Não aplica nada: devolve a mudança proposta, e quem aplica é a pessoa com
   * um toque. É a diferença entre uma busca errada — um parágrafo que se apaga
   * — e uma reorganização errada, que é a aula de ontem embaralhada sem
   * desfazer. Quando isto existe, `run` não é chamado.
   */
  propoe?: (argument: string, contexto: ContextoDaNota) => MudancaNaNota | null;
};

/** Resultado de uma rodada do laço: ou a resposta final, ou uma chamada de ferramenta. */
export type AgentStep =
  | { kind: 'answer'; text: string }
  | { kind: 'tool'; tool: string; argument: string };

/** Uma mudança que a IA propôs e que espera aprovação. */
export type Proposta = {
  ferramenta: string;
  mudanca: MudancaNaNota;
};

/** Registro do que aconteceu, para a interface mostrar o raciocínio. */
export type ToolTrace = {
  tool: string;
  argument: string;
  result: string;
  failed?: boolean;
};
