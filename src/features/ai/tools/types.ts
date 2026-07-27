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
};

/** Resultado de uma rodada do laço: ou a resposta final, ou uma chamada de ferramenta. */
export type AgentStep =
  | { kind: 'answer'; text: string }
  | { kind: 'tool'; tool: string; argument: string };

/** Registro do que aconteceu, para a interface mostrar o raciocínio. */
export type ToolTrace = {
  tool: string;
  argument: string;
  result: string;
  failed?: boolean;
};
