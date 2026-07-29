/**
 * Ler o extrato de crédito sem precisar do servidor.
 *
 * Funções puras sobre as linhas que a `credit_ledger` devolve. Aqui não se
 * decide nada sobre dinheiro — quem decide é o banco, com `consume_credits` e
 * `grant_credits`, e nenhuma das duas pode ser chamada pelo aplicativo para
 * criar crédito. Isto é só apresentação.
 *
 * E é o suficiente para o que a tela precisa responder: "para onde foi o meu
 * crédito". Um extrato de trinta linhas dizendo "ia -2" não responde. Somado
 * por motivo, com o nome em português e a data agrupada por dia, responde.
 */

export type LinhaDoExtrato = {
  id: number;
  /** Positivo entra, negativo sai. */
  delta: number;
  motivo: string;
  quando: number;
};

/**
 * Os motivos que o servidor grava.
 *
 * Ficam aqui porque a tela precisa traduzir, e o servidor grava em código —
 * `ia`, `transcricao`. Motivo desconhecido não é erro: motivos novos vão
 * aparecer antes de o app ser atualizado, e a tela precisa mostrar alguma coisa
 * em vez de uma linha em branco.
 */
const NOMES: Record<string, string> = {
  ia: 'Assistente',
  transcricao: 'Transcrição',
  compra: 'Compra de pacote',
  bonus: 'Bônus',
  estorno: 'Estorno',
  assinatura: 'Créditos do plano',
};

export const nomeDoMotivo = (motivo: string): string =>
  NOMES[motivo] ?? motivo.charAt(0).toUpperCase() + motivo.slice(1);

const ICONES: Record<string, string> = {
  ia: 'cpu',
  transcricao: 'mic',
  compra: 'shopping-bag',
  bonus: 'gift',
  estorno: 'rotate-ccw',
  assinatura: 'award',
};

export const iconeDoMotivo = (motivo: string): string => ICONES[motivo] ?? 'circle';

export type GastoPorMotivo = {
  motivo: string;
  nome: string;
  creditos: number;
  /** Fração do gasto total, de 0 a 1. Para a barra. */
  fracao: number;
};

/**
 * Para onde o crédito foi, somado por motivo.
 *
 * Só o que SAIU. Misturar entrada e saída no mesmo gráfico daria uma barra de
 * "compra" gigante ao lado das de consumo, e a pergunta que a pessoa faz não é
 * "quanto comprei" — o saldo já responde isso —, é "o que está gastando".
 */
export function gastoPorMotivo(linhas: LinhaDoExtrato[]): GastoPorMotivo[] {
  const soma = new Map<string, number>();
  for (const l of linhas) {
    if (l.delta >= 0) continue;
    soma.set(l.motivo, (soma.get(l.motivo) ?? 0) + Math.abs(l.delta));
  }

  const total = [...soma.values()].reduce((s, n) => s + n, 0);
  return [...soma.entries()]
    .map(([motivo, creditos]) => ({
      motivo,
      nome: nomeDoMotivo(motivo),
      creditos,
      fracao: total > 0 ? creditos / total : 0,
    }))
    .sort((a, b) => b.creditos - a.creditos);
}

export type GrupoDoExtrato = {
  /** O dia, já em palavras: "Hoje", "Ontem", "12 de agosto". */
  titulo: string;
  linhas: LinhaDoExtrato[];
};

/**
 * O extrato agrupado por dia.
 *
 * As linhas já chegam em ordem decrescente do servidor; o agrupamento preserva
 * essa ordem em vez de reordenar, porque reordenar aqui esconderia um erro de
 * ordenação lá — e um extrato fora de ordem é o tipo de coisa que faz a pessoa
 * achar que foi cobrada duas vezes.
 */
export function agruparPorDia(linhas: LinhaDoExtrato[], agora = Date.now()): GrupoDoExtrato[] {
  const grupos: GrupoDoExtrato[] = [];
  let atual: GrupoDoExtrato | null = null;

  for (const linha of linhas) {
    const titulo = diaEmPalavras(linha.quando, agora);
    if (!atual || atual.titulo !== titulo) {
      atual = { titulo, linhas: [] };
      grupos.push(atual);
    }
    atual.linhas.push(linha);
  }
  return grupos;
}

function diaEmPalavras(quando: number, agora: number): string {
  const d = new Date(quando);
  const hoje = new Date(agora);
  const ontem = new Date(agora - 24 * 60 * 60 * 1000);

  if (mesmoDia(d, hoje)) return 'Hoje';
  if (mesmoDia(d, ontem)) return 'Ontem';

  return d.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: d.getFullYear() === hoje.getFullYear() ? undefined : 'numeric',
  });
}

const mesmoDia = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * Quanto tempo o saldo ainda dura, no ritmo dos últimos dias.
 *
 * Devolve nulo quando não dá para dizer, e "não dá para dizer" é o caso comum:
 * sem consumo nenhum, ou com consumo só de hoje, qualquer projeção seria chute
 * apresentado como número. Nulo faz a tela não mostrar nada, que é honesto —
 * um "dura 3 dias" errado é pior que um espaço em branco.
 */
export function duracaoDoSaldo(
  saldo: number,
  linhas: LinhaDoExtrato[],
  agora = Date.now()
): number | null {
  if (saldo <= 0) return 0;

  const trintaDias = agora - 30 * 24 * 60 * 60 * 1000;
  const recentes = linhas.filter((l) => l.delta < 0 && l.quando >= trintaDias);
  if (recentes.length < 3) return null;

  const maisAntiga = Math.min(...recentes.map((l) => l.quando));
  const dias = Math.max(1, (agora - maisAntiga) / (24 * 60 * 60 * 1000));
  const gasto = recentes.reduce((s, l) => s + Math.abs(l.delta), 0);
  const porDia = gasto / dias;
  if (porDia <= 0) return null;

  return Math.floor(saldo / porDia);
}

/** Preço em centavos, como a pessoa lê. */
export const emReais = (centavos: number): string =>
  `R$ ${(centavos / 100).toFixed(2).replace('.', ',')}`;

/**
 * O preço por crédito, para o desconto por volume ser visível.
 *
 * Sem isto a pessoa tem de dividir de cabeça para descobrir qual pacote
 * compensa — e ninguém divide, então ninguém percebe que o pacote grande é mais
 * barato, e o desconto que existe no banco não vende nada.
 */
export const precoPorCredito = (centavos: number, creditos: number): string =>
  creditos > 0 ? `R$ ${(centavos / 100 / creditos).toFixed(4).replace('.', ',')} cada` : '';

/** Quanto o pacote economiza em relação ao menor, em pontos percentuais. */
export function desconto(
  centavos: number,
  creditos: number,
  refCentavos: number,
  refCreditos: number
): number {
  if (creditos <= 0 || refCreditos <= 0) return 0;
  const unidade = centavos / creditos;
  const referencia = refCentavos / refCreditos;
  if (referencia <= 0) return 0;
  return Math.round((1 - unidade / referencia) * 100);
}
