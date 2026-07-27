import { View } from 'react-native';
import Svg, { Circle, Path, Polyline } from 'react-native-svg';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';
import type { DadosGrafico, PontoGrafico } from '../model/blocks';
import { coordenadasDaLinha, escalaDeBarras, fatiasDaPizza } from '../utils/chart-math';

/**
 * Gráfico dentro da nota.
 *
 * Três formas, cada uma para um trabalho diferente:
 *   barra  — comparar grandeza entre categorias (nota por matéria)
 *   linha  — acompanhar mudança ao longo do tempo
 *   pizza  — parte de um todo, de relance
 *
 * Decisões que valem explicar:
 *
 * Barra e linha são UMA série, então usam UMA cor — a cor de destaque escolhida
 * pela pessoa. Pintar cada barra de um tom diferente conforme o valor pareceria
 * mais bonito e seria errado: gastaria o canal de cor repetindo a informação que
 * o comprimento da barra já dá, e cor deixaria de significar identidade.
 *
 * A pizza é o único caso em que a cor carrega identidade, e aí usa uma paleta
 * fixa, conferida com validador para continuar distinguível por quem enxerga
 * cores de forma diferente. Mesmo assim cada fatia vem com rótulo e valor
 * escritos: a cor é reforço, nunca a única pista.
 *
 * As barras são desenhadas com View comum em vez de SVG. Além de mais simples,
 * evita depender de fonte dentro do SVG, que é onde texto costuma sumir ou sair
 * de lugar no Android.
 */

/**
 * Paleta categórica, conferida com o validador nos dois fundos.
 * Claro:  pior par adjacente ΔE 9,1 (protanopia) e 19,6 (visão comum).
 * Escuro: pior par adjacente ΔE 8,4 e 19,3.
 * As colunas não são paletas diferentes: são os mesmos oito matizes, cada um
 * ajustado para o fundo em que vai aparecer.
 */
const PALETA = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
};

/**
 * Pizza é para ver de relance, e acima disso vira sopa. O excedente entra como
 * "Outros" em vez de ganhar cores novas — inventar um nono matiz produziria uma
 * cor que ninguém consegue separar das que já estão lá.
 */
const MAXIMO_FATIAS = 6;

type GraficoProps = {
  dados: DadosGrafico;
  /** Largura disponível. A altura sai daqui, para o gráfico não achatar. */
  largura: number;
};

export function Grafico({ dados, largura }: GraficoProps) {
  const { mode, tokens } = useTheme();

  const pontos = (dados?.dados ?? []).filter((p): p is PontoGrafico => Boolean(p));
  const titulo = dados?.titulo?.trim();

  if (pontos.length === 0) {
    return (
      <View className="items-center rounded-2xl border border-dashed border-hairline-light py-6 dark:border-hairline-dark">
        <AppText variant="small">Gráfico sem dados — toque para preencher</AppText>
      </View>
    );
  }

  return (
    <View className="rounded-2xl bg-subtle-light p-3.5 dark:bg-subtle-dark">
      {titulo ? (
        <AppText variant="bodyEmphasis" className="mb-3">
          {titulo}
        </AppText>
      ) : null}

      {dados.tipo === 'barra' ? (
        <Barras pontos={pontos} cor={tokens.accent} />
      ) : dados.tipo === 'linha' ? (
        <Linha pontos={pontos} cor={tokens.accent} largura={largura} corEixo={tokens.hairline} />
      ) : (
        <Pizza pontos={pontos} paleta={PALETA[mode]} corFundo={tokens.subtle} />
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ barras */

function Barras({ pontos, cor }: { pontos: PontoGrafico[]; cor: string }) {
  const maior = escalaDeBarras(pontos);

  return (
    <View className="gap-2.5">
      {pontos.map((ponto, indice) => {
        const fracao = Math.min(1, Math.abs(ponto.valor) / maior);

        return (
          <View key={indice}>
            <View className="mb-1 flex-row items-baseline justify-between gap-2">
              <AppText variant="small" className="flex-1" numberOfLines={1}>
                {ponto.rotulo || '—'}
              </AppText>
              {/* Rótulo direto em vez de eixo: o valor exato fica ao lado do
                  dado, sem obrigar a medir a barra contra uma régua. */}
              <AppText variant="small" className="text-ink-light dark:text-ink-dark">
                {formatar(ponto.valor)}
              </AppText>
            </View>

            <View className="h-2.5 overflow-hidden rounded-full bg-hairline-light dark:bg-hairline-dark">
              <View
                style={{
                  width: `${fracao * 100}%`,
                  backgroundColor: cor,
                  // Ponta arredondada só é possível com largura suficiente;
                  // abaixo disso o raio deforma a barra.
                  borderRadius: 999,
                }}
                className="h-full"
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------- linha */

function Linha({
  pontos,
  cor,
  largura,
  corEixo,
}: {
  pontos: PontoGrafico[];
  cor: string;
  largura: number;
  corEixo: string;
}) {
  const altura = 140;
  const margem = 10;

  // Um ponto só não forma linha; vira um marcador no meio, que é honesto.
  const coordenadas = coordenadasDaLinha(pontos, largura, altura, margem);

  return (
    <View>
      <Svg width={largura} height={altura}>
        {/* Linha de base recessiva: orienta sem competir com o dado. */}
        <Polyline
          points={`${margem},${altura - margem} ${largura - margem},${altura - margem}`}
          stroke={corEixo}
          strokeWidth={1}
        />

        <Polyline
          points={coordenadas.map((c) => `${c.x},${c.y}`).join(' ')}
          fill="none"
          stroke={cor}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {coordenadas.map((c, indice) => (
          <Circle key={indice} cx={c.x} cy={c.y} r={4} fill={cor} />
        ))}
      </Svg>

      {/* Só as pontas recebem rótulo. Escrever o valor de todos os pontos é o
          jeito mais rápido de tornar a linha ilegível. */}
      <View className="mt-1 flex-row justify-between">
        <AppText variant="small" numberOfLines={1}>
          {pontos[0].rotulo} · {formatar(pontos[0].valor)}
        </AppText>
        {pontos.length > 1 ? (
          <AppText variant="small" numberOfLines={1}>
            {pontos[pontos.length - 1].rotulo} · {formatar(pontos[pontos.length - 1].valor)}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------- pizza */

function Pizza({
  pontos,
  paleta,
  corFundo,
}: {
  pontos: PontoGrafico[];
  paleta: string[];
  corFundo: string;
}) {
  const tamanho = 150;
  const centro = tamanho / 2;
  const raio = centro - 4;

  const fatias = fatiasDaPizza(pontos, MAXIMO_FATIAS, centro, raio);

  if (fatias.length === 0) {
    return <AppText variant="small">Sem valores para dividir</AppText>;
  }

  return (
    <View className="flex-row items-center gap-4">
      <Svg width={tamanho} height={tamanho}>
        {fatias.map((fatia, indice) => {
          if (fatia.valor <= 0) return null;
          const cor = paleta[indice % paleta.length];

          if (fatia.circuloInteiro) {
            return <Circle key={indice} cx={centro} cy={centro} r={raio} fill={cor} />;
          }

          return (
            <Path
              key={indice}
              d={fatia.caminho}
              fill={cor}
              // Fresta na cor do fundo separa fatias vizinhas sem inventar
              // uma borda escura que pareceria parte do dado.
              stroke={corFundo}
              strokeWidth={2}
            />
          );
        })}
      </Svg>

      {/* A legenda não é enfeite: no fundo claro três cores da paleta ficam
          abaixo de 3:1 de contraste, e a regra é compensar com rótulo visível.
          Com rótulo e valor escritos, quem não distingue as cores lê igual. */}
      <View className="flex-1 gap-1.5">
        {fatias.map((fatia, indice) => (
          <View key={indice} className="flex-row items-center gap-2">
            <View
              style={{ backgroundColor: paleta[indice % paleta.length] }}
              className="h-2.5 w-2.5 rounded-full"
            />
            <AppText variant="small" className="flex-1" numberOfLines={1}>
              {fatia.rotulo || '—'}
            </AppText>
            <AppText variant="small" className="text-ink-light dark:text-ink-dark">
              {Math.round(fatia.proporcao * 100)}%
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ apoio */

/** Sem casas decimais quando o número é inteiro; no máximo duas quando não é. */
function formatar(valor: number): string {
  if (!Number.isFinite(valor)) return '0';
  return Number.isInteger(valor) ? String(valor) : valor.toFixed(2).replace('.', ',');
}
