import { Easing } from 'react-native-reanimated';

/**
 * O sistema de movimento, copiado do Material 3.
 *
 * Animação em app não é enfeite: é o que responde "para onde isso foi" e "de
 * onde isso veio". Um painel que aparece do nada obriga a pessoa a reconstruir
 * a tela na cabeça; o mesmo painel subindo de baixo já contou a história.
 *
 * O que separa movimento bom de exagero é uma coisa só: DURAÇÃO. Abaixo de
 * 150ms o olho não acompanha e vira piscada; acima de 500ms vira espera. Os
 * números daqui são os do Google, e existem para ninguém precisar chutar 300
 * de novo em cada componente.
 */

/**
 * As curvas do Material 3.
 *
 * A "enfatizada" é a assinatura do movimento do Google: sai devagar, acelera
 * forte no meio e freia longo no fim. É o que dá a sensação de peso — o objeto
 * parece ter massa em vez de teletransportar.
 *
 * A diferença entre ENTRAR e SAIR é o que mais engana quem começa. Coisa que
 * entra desacelera (chega e assenta); coisa que sai acelera (some rápido, e
 * ninguém quer esperar por algo que está indo embora). Usar a mesma curva nos
 * dois faz a saída parecer travada.
 */
export const curva = {
  /** Padrão para o que se move na tela sem entrar nem sair. */
  enfatizada: Easing.bezier(0.2, 0.0, 0.0, 1.0),
  /** Para o que ENTRA: freia longo no fim. */
  entrada: Easing.bezier(0.05, 0.7, 0.1, 1.0),
  /** Para o que SAI: acelera e some. */
  saida: Easing.bezier(0.3, 0.0, 0.8, 0.15),
  /** Movimento pequeno e funcional, sem drama: troca de estado, tinta, opacidade. */
  padrao: Easing.bezier(0.2, 0.0, 0.0, 1.0),
  /** Volta ao repouso depois de um toque. */
  repouso: Easing.out(Easing.quad),
} as const;

/**
 * Durações, em milissegundos.
 *
 * A regra que as ordena: quanto MAIOR a coisa que se move, mais tempo ela
 * precisa. Um ícone que muda de cor em 400ms parece lento; um painel que cobre
 * a tela em 100ms parece um susto.
 */
export const duracao = {
  /** Tinta, opacidade, ícone trocando. Curto a ponto de não se notar. */
  instante: 100,
  /** Toque afundando e voltando, seleção, alternância. */
  curta: 180,
  /** O padrão: item aparecendo na lista, cartão crescendo. */
  media: 260,
  /** Painel subindo, tela entrando, algo que cobre boa parte do espaço. */
  longa: 380,
  /** Só para o que atravessa a tela inteira. Acima disto vira espera. */
  travessia: 480,
} as const;

/**
 * Mola para o que responde ao dedo.
 *
 * Curva de tempo não serve aqui: quando a pessoa solta o dedo no meio, uma
 * curva de tempo continua até o fim como se nada tivesse acontecido, e a mola
 * pega a velocidade que o dedo deixou e continua dali.
 *
 * `damping` em 2·√stiffness deixa a mola CRITICAMENTE amortecida: chega rápido
 * e para seco, sem passar do ponto e voltar. Abaixo disso ela oscila, e
 * interface que treme parece quebrada, não animada.
 */
export const mola = {
  /** Resposta ao toque: rápida, sem oscilar. */
  firme: { damping: 40, stiffness: 400, mass: 1 },
  /** Um tiquinho de vida no fim — para o que cresce, nunca para o que desliza. */
  suave: { damping: 26, stiffness: 220, mass: 1 },
} as const;

/**
 * Escala de um item na lista, pela posição.
 *
 * Itens entrando todos ao mesmo tempo viram um bloco piscando. Em cascata, o
 * olho segue a ordem e entende que é uma lista.
 *
 * O teto existe porque a cascata cresce linear e a paciência não: no vigésimo
 * item, 20 x 30ms seriam 600ms de espera para ver o fim de uma lista que já
 * está desenhada. Depois do oitavo, todos entram juntos e ninguém percebe.
 */
export function atrasoEmCascata(indice: number, passo = 28, teto = 8): number {
  if (!Number.isFinite(indice) || indice <= 0) return 0;
  return Math.min(indice, teto) * passo;
}

/**
 * Quanto um elemento afunda ao ser tocado.
 *
 * 0,97 e não 0,90: o toque precisa ser sentido, não anunciado. Encolher demais
 * chama atenção para a animação em vez de confirmar o toque, e num botão que a
 * pessoa aperta cinquenta vezes por dia isso cansa.
 */
export const ESCALA_AO_TOCAR = 0.97;
