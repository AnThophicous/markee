/**
 * Avisos que aparecem no alto da tela.
 *
 * Existe por causa de um defeito de classe, e não de um caso: 53 chamadas de
 * gravação no app não tratavam erro nenhum. Quando qualquer uma falhava, nada
 * acontecia na tela — e "toquei e não aconteceu nada" é indistinguível de
 * travamento para quem está usando. Foi assim que "não dá para apagar grupo"
 * passou despercebido: o servidor recusava e o app não contava.
 *
 * Consertar as 53 uma a uma seria 53 remendos e a 54ª nasceria sem tratamento
 * de novo. Aqui o `MutationCache` do React Query já vê TODA falha de gravação
 * que acontece no app; só faltava mostrar.
 *
 * Sem biblioteca de estado: é uma lista de interessados e uma função que avisa.
 * Um provider de contexto para isto atravessaria a árvore inteira para entregar
 * uma string.
 */

export type Aviso = {
  id: number;
  texto: string;
  tom: 'erro' | 'ok';
};

type Ouvinte = (aviso: Aviso | null) => void;

const ouvintes = new Set<Ouvinte>();
let atual: Aviso | null = null;
let proximoId = 1;
let relogio: ReturnType<typeof setTimeout> | null = null;

/** Quanto tempo o aviso fica na tela antes de sair sozinho. */
const DURACAO = 5000;

/**
 * Um ouvinte que explode não pode derrubar os outros — nem o app.
 *
 * Isto roda de dentro do tratador de erro do React Query: uma exceção aqui
 * seria uma falha ao relatar uma falha, e derrubaria o app por causa de algo
 * que já tinha dado errado e estava sendo contornado.
 */
function entregar(ouvinte: Ouvinte, aviso: Aviso | null) {
  try {
    ouvinte(aviso);
  } catch {
    // de propósito
  }
}

function emitir(aviso: Aviso | null) {
  atual = aviso;
  for (const ouvinte of ouvintes) entregar(ouvinte, aviso);
}

export function assinarAvisos(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  // Também protegido: a primeira entrega é uma chamada como qualquer outra, e
  // deixá-la fora da proteção era um buraco — foi o teste que achou.
  entregar(ouvinte, atual);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function limparAviso() {
  if (relogio) clearTimeout(relogio);
  relogio = null;
  emitir(null);
}

export function avisar(texto: string, tom: Aviso['tom'] = 'erro') {
  const limpo = texto.trim();
  if (!limpo) return;

  // Mensagem repetida não reinicia a contagem nem pisca de novo: o salvamento
  // automático da nota tenta a cada 600ms, e sem isto uma falha de rede viraria
  // a mesma frase aparecendo dezenas de vezes por minuto.
  if (atual && atual.texto === limpo && atual.tom === tom) return;

  if (relogio) clearTimeout(relogio);
  emitir({ id: proximoId++, texto: limpo, tom });
  relogio = setTimeout(() => emitir(null), DURACAO);
}

/**
 * Traduz o que o servidor devolve para algo que dá para ler.
 *
 * As mensagens do Postgres e do Supabase são escritas para quem programa. Uma
 * pessoa que vê "new row violates row-level security policy for table
 * group_members" não descobre com isso que faltou permissão — e o que ela
 * precisa saber é só isso.
 */
export function emPortugues(mensagem: string): string {
  const m = mensagem.toLowerCase();

  if (m.includes('row-level security') || m.includes('permission denied')) {
    return 'Você não tem permissão para isso neste grupo.';
  }
  if (m.includes('network request failed') || m.includes('failed to fetch') || m.includes('timeout')) {
    return 'Sem conexão com o servidor. Tente de novo.';
  }
  if (m.includes('jwt') || m.includes('not authenticated') || m.includes('invalid claim')) {
    return 'Sua sessão expirou. Entre na conta de novo.';
  }
  if (m.includes('duplicate key')) {
    return 'Isso já existe.';
  }
  // Os gatilhos do banco já escrevem em português e explicam o que houve —
  // "O status precisa ter no máximo 60 caracteres." é melhor do que qualquer
  // reescrita genérica. Passam direto.
  return mensagem;
}
