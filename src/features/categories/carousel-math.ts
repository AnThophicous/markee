/**
 * A matemática do carrossel de categorias.
 *
 * Fica separada do desenho de propósito: é aritmética de anel, e aritmética de
 * anel erra CALADO. Um resto negativo num lugar faz o cartão da esquerda
 * aparecer na direita só quando a lista tem número par de itens, ou só quando a
 * pessoa arrasta para um lado — o tipo de defeito que não dá erro, não aparece
 * em revisão e só é notado por quem usa e acha o app estranho.
 *
 * O anel é infinito: passar do último volta ao primeiro pelo caminho mais
 * curto, nos dois sentidos. Não existe "fim da lista".
 */

/** Onde cada cartão fica em relação ao do meio. */
export type Posicao = {
  /** -1 esquerda, 0 meio, 1 direita. Fora disso está atrás, invisível. */
  slot: number;
  escala: number;
  opacidade: number;
  /** Quem desenha por cima de quem. O do meio sempre ganha. */
  camada: number;
};

/**
 * Distância com sinal entre dois índices, pelo caminho mais curto do anel.
 *
 * Com 5 categorias e a terceira no meio, a primeira está a -2 e a quinta a +2.
 * Mas com a PRIMEIRA no meio, a quinta está a -1 (ela vem pela esquerda), e não
 * a +4 — é isso que faz o anel não ter fim.
 *
 * O `((x % n) + n) % n` existe porque o resto de negativo em JavaScript é
 * negativo: `-1 % 5` dá -1, não 4. Usar `%` direto quebraria toda vez que a
 * pessoa arrastasse para trás a partir do primeiro item.
 */
export function distanciaNoAnel(indice: number, ativo: number, total: number): number {
  if (total <= 0) return 0;

  const bruta = (((indice - ativo) % total) + total) % total;

  // Acima da metade, o caminho curto é pelo outro lado.
  //
  // Com total PAR o item exatamente oposto empata: está à mesma distância pelos
  // dois lados. Fica com o sinal positivo — precisa de um critério fixo, senão
  // ele pisca de um lado para o outro conforme o arredondamento.
  return bruta > total / 2 ? bruta - total : bruta;
}

/**
 * Como o cartão aparece, dada a distância dele até o meio.
 *
 * `deslocamento` é fracionário durante o arrasto: em 0,5 o carrossel está no
 * meio do caminho entre duas posições, e todos os cartões estão entre dois
 * estados. É isso que faz o movimento acompanhar o dedo em vez de saltar de
 * posição em posição quando o dedo solta.
 */
export function posicaoDoCartao(
  indice: number,
  ativo: number,
  total: number,
  deslocamento = 0
): Posicao {
  const slot = distanciaNoAnel(indice, ativo, total) - deslocamento;
  const distancia = Math.abs(slot);

  // O do meio é maior; os dos lados encolhem com a distância. O corte em 2
  // define quem já está "atrás" e não precisa mais ser desenhado.
  const escala = Math.max(0.62, 1 - distancia * 0.19);

  // Some antes de encolher até o fim, senão o cartão de trás fica visível como
  // uma miniatura espremida no canto em vez de parecer que foi para o fundo.
  const opacidade = distancia >= 2 ? 0 : Math.max(0, 1 - distancia * 0.45);

  // Quanto mais perto do meio, mais na frente. Inteiro porque `zIndex`
  // fracionário é ignorado no Android.
  const camada = Math.round(100 - distancia * 10);

  return { slot, escala, opacidade, camada };
}

/**
 * Quais índices vale a pena desenhar.
 *
 * Só os que aparecem, mais um de cada lado que está entrando ou saindo. Numa
 * lista de trinta categorias, desenhar as trinta a cada quadro do arrasto é o
 * que transforma um carrossel bonito numa animação travada.
 */
export function visiveis(ativo: number, total: number, alcance = 2): number[] {
  if (total <= 0) return [];
  if (total <= alcance * 2 + 1) return Array.from({ length: total }, (_, i) => i);

  const lista: number[] = [];
  for (let d = -alcance; d <= alcance; d++) {
    lista.push((((ativo + d) % total) + total) % total);
  }
  return lista;
}

/**
 * Para onde o carrossel vai quando o dedo solta.
 *
 * Não é só "arrastou meio cartão, troca": a VELOCIDADE conta. Um lance rápido e
 * curto tem de virar o cartão, porque a intenção estava clara — exigir meia
 * largura em todo caso faz o gesto rápido parecer que não pegou, e a pessoa
 * repete com força até passar dois de uma vez.
 */
export function destinoAoSoltar(
  ativo: number,
  arrasto: number,
  velocidade: number,
  larguraDoPasso: number,
  total: number
): number {
  if (total <= 0) return 0;

  /**
   * O sinal é invertido em relação ao arrasto, e isso é fácil de errar.
   *
   * Arrastar para a ESQUERDA (arrasto negativo) AVANÇA: o conteúdo anda para a
   * esquerda e revela o próximo, que estava à direita. É o mesmo sentido de
   * virar página. Sem a inversão, o carrossel anda para o lado contrário do
   * dedo — e foi assim que a primeira versão saiu.
   */
  const passos = -arrasto / larguraDoPasso;
  const rapido = Math.abs(velocidade) > 500;

  let alvo: number;
  if (rapido) {
    // No lance rápido anda UM só, no sentido do gesto. Deixar a velocidade
    // multiplicar o número de passos faria um gesto forte atravessar metade
    // das categorias, e ninguém consegue mirar assim.
    //
    // Se o dedo mal saiu do lugar, o sentido vem da velocidade — também
    // invertida, pela mesma razão.
    const sentido = passos !== 0 ? Math.sign(passos) : Math.sign(-velocidade);
    alvo = ativo + sentido;
  } else {
    alvo = ativo + Math.round(passos);
  }

  return (((alvo % total) + total) % total);
}
