import type { PontoGrafico } from '../model/blocks';

/**
 * A geometria dos gráficos, separada do desenho para poder ser testada.
 *
 * Não é organização por gosto: é aqui que mora o risco real. Toda divisão neste
 * arquivo tem um denominador que pode ser zero — todos os valores iguais, total
 * zero, um ponto só — e uma divisão por zero vira NaN, que entra na string do
 * caminho SVG como "M 75 75 L NaN NaN". No Android isso não desenha nada, e o
 * gráfico simplesmente some sem erro nenhum, que é o pior defeito de todos:
 * invisível.
 *
 * Por isso cada função devolve número finito em qualquer entrada, e o teste
 * empurra justamente os casos degenerados.
 */

export type Coordenada = { x: number; y: number; ponto: PontoGrafico };

export type Fatia = {
  rotulo: string;
  valor: number;
  proporcao: number;
  /** Verdadeiro quando a fatia ocupa o círculo todo e precisa virar círculo. */
  circuloInteiro: boolean;
  caminho: string;
};

/** Maior valor absoluto, nunca zero — o retorno é sempre um denominador seguro. */
export function escalaDeBarras(pontos: PontoGrafico[]): number {
  const valores = pontos.map((p) => Math.abs(Number(p?.valor) || 0)).filter(Number.isFinite);
  const maior = valores.length > 0 ? Math.max(...valores) : 0;
  return maior > 0 ? maior : 1;
}

export function coordenadasDaLinha(
  pontos: PontoGrafico[],
  largura: number,
  altura: number,
  margem: number
): Coordenada[] {
  if (pontos.length === 0) return [];

  const valores = pontos.map((p) => (Number.isFinite(Number(p?.valor)) ? Number(p.valor) : 0));
  const maior = Math.max(...valores);
  const menor = Math.min(...valores);

  // Todos os valores iguais deixaria a faixa em zero. Com `|| 1` a divisão
  // resulta em zero e a linha fica reta no meio, que é a leitura correta.
  const faixa = maior - menor || 1;

  const util = Math.max(1, largura - margem * 2);
  const passo = pontos.length > 1 ? util / (pontos.length - 1) : 0;
  const alturaUtil = Math.max(1, altura - margem * 2);

  return pontos.map((ponto, indice) => ({
    x: pontos.length > 1 ? margem + indice * passo : largura / 2,
    y: margem + (1 - (valores[indice] - menor) / faixa) * alturaUtil,
    ponto,
  }));
}

/**
 * Reparte a pizza. Valores negativos entram como zero: em parte-de-um-todo eles
 * não têm significado, e um ângulo negativo desenharia por cima das vizinhas.
 */
export function fatiasDaPizza(
  pontos: PontoGrafico[],
  maximoFatias: number,
  centro: number,
  raio: number
): Fatia[] {
  const positivos = pontos.map((p) => ({
    rotulo: p?.rotulo ?? '',
    valor: Number.isFinite(Number(p?.valor)) ? Math.max(0, Number(p.valor)) : 0,
  }));

  const agrupados =
    positivos.length > maximoFatias
      ? [
          ...positivos.slice(0, maximoFatias),
          {
            rotulo: 'Outros',
            valor: positivos.slice(maximoFatias).reduce((soma, p) => soma + p.valor, 0),
          },
        ]
      : positivos;

  const total = agrupados.reduce((soma, f) => soma + f.valor, 0);
  if (total <= 0) return [];

  let angulo = -Math.PI / 2; // começa no topo, que é onde o olho começa a ler

  return agrupados.map((fatia) => {
    const proporcao = fatia.valor / total;
    const inicio = angulo;
    const fim = inicio + proporcao * Math.PI * 2;
    angulo = fim;

    // Arco de volta inteira colapsa: início e fim caem no mesmo ponto e o
    // traçado desaparece. Quem desenha precisa saber para usar um círculo.
    const circuloInteiro = proporcao >= 0.999;

    const x1 = centro + raio * Math.cos(inicio);
    const y1 = centro + raio * Math.sin(inicio);
    const x2 = centro + raio * Math.cos(fim);
    const y2 = centro + raio * Math.sin(fim);
    const arcoGrande = proporcao > 0.5 ? 1 : 0;

    return {
      ...fatia,
      proporcao,
      circuloInteiro,
      caminho: `M ${centro} ${centro} L ${arredondar(x1)} ${arredondar(y1)} A ${raio} ${raio} 0 ${arcoGrande} 1 ${arredondar(x2)} ${arredondar(y2)} Z`,
    };
  });
}

/** Duas casas bastam para o traçado e encurtam bastante a string do caminho. */
function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}
