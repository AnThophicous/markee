import { memo } from 'react';
import { Image, Pressable, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';
import { isSelfHostedImage } from '@/utils/url-safety';
import type { Bloco } from '../model/blocks';
import { Grafico } from './Grafico';

/**
 * Blocos que não são digitados: divisor, imagem, gráfico e tabela.
 *
 * Cada um tem um jeito próprio de ser mexido — a tabela edita célula por
 * célula, o gráfico abre um painel, a imagem só é trocada ou removida. Ficam
 * separados da linha de texto porque forçá-los no mesmo componente encheria
 * aquele arquivo de condições que não têm nada a ver com digitar.
 */

type BlocoVisualProps = {
  bloco: Bloco;
  larguraDisponivel: number;
  onAbrirMenu: (id: string) => void;
  onEditarGrafico: (id: string) => void;
  onMudarCelula: (id: string, linha: number, coluna: number, valor: string) => void;
  onAdicionarLinha: (id: string) => void;
  onAdicionarColuna: (id: string) => void;
  onLegendaImagem: (id: string, legenda: string) => void;
};

function BlocoVisualBase({
  bloco,
  larguraDisponivel,
  onAbrirMenu,
  onEditarGrafico,
  onMudarCelula,
  onAdicionarLinha,
  onAdicionarColuna,
  onLegendaImagem,
}: BlocoVisualProps) {
  const { tokens } = useTheme();

  return (
    <View className="flex-row items-start px-5 py-1">
      <View className="flex-1">
        {bloco.tipo === 'divisor' ? (
          <View className="my-3 h-px bg-hairline-light dark:bg-hairline-dark" />
        ) : bloco.tipo === 'imagem' ? (
          <Imagem bloco={bloco} onLegenda={onLegendaImagem} />
        ) : bloco.tipo === 'grafico' ? (
          <Pressable onPress={() => onEditarGrafico(bloco.id)}>
            <Grafico
              dados={bloco.grafico ?? { tipo: 'barra', titulo: '', dados: [] }}
              // Desconta o recuo lateral e a alça de opções, senão o desenho
              // encosta na borda e a última barra fica cortada.
              largura={Math.max(80, larguraDisponivel - 70)}
            />
          </Pressable>
        ) : (
          <Tabela
            bloco={bloco}
            onMudarCelula={onMudarCelula}
            onAdicionarLinha={onAdicionarLinha}
            onAdicionarColuna={onAdicionarColuna}
          />
        )}
      </View>

      <Pressable onPress={() => onAbrirMenu(bloco.id)} hitSlop={10} className="ml-1 pt-1">
        <Feather name="more-vertical" size={14} color={tokens.hairline} />
      </Pressable>
    </View>
  );
}

function Imagem({ bloco, onLegenda }: { bloco: Bloco; onLegenda: (id: string, legenda: string) => void }) {
  const { tokens } = useTheme();
  const url = bloco.url ?? '';

  /**
   * A mesma regra da leitura vale aqui: só imagem do nosso servidor é
   * carregada. Buscar uma imagem de fora abriria conexão com quem a hospeda e
   * entregaria IP e horário de quem está lendo a nota.
   */
  if (!isSelfHostedImage(url)) {
    return (
      <View className="flex-row items-center gap-3 rounded-xl border border-hairline-light p-3 dark:border-hairline-dark">
        <Feather name="image" size={18} color={tokens.muted} />
        <View className="flex-1">
          <AppText variant="caption">Imagem de fora</AppText>
          <AppText variant="small" numberOfLines={1}>
            Não é carregada aqui para não entregar seu IP a quem a hospeda
          </AppText>
        </View>
      </View>
    );
  }

  return (
    <View>
      <Image
        source={{ uri: url }}
        className="h-52 w-full rounded-xl"
        resizeMode="cover"
        accessibilityLabel={bloco.texto || 'Imagem da nota'}
      />
      <TextInput
        value={bloco.texto}
        onChangeText={(texto) => onLegenda(bloco.id, texto)}
        placeholder="Legenda (opcional)"
        placeholderTextColor={tokens.muted}
        className="mt-1.5 text-[13px] text-muted-light dark:text-muted-dark"
        style={{ padding: 0 }}
      />
    </View>
  );
}

function Tabela({
  bloco,
  onMudarCelula,
  onAdicionarLinha,
  onAdicionarColuna,
}: {
  bloco: Bloco;
  onMudarCelula: (id: string, linha: number, coluna: number, valor: string) => void;
  onAdicionarLinha: (id: string) => void;
  onAdicionarColuna: (id: string) => void;
}) {
  const { tokens } = useTheme();
  const linhas = bloco.linhas ?? [];

  return (
    <View>
      <View className="overflow-hidden rounded-xl border border-hairline-light dark:border-hairline-dark">
        {linhas.map((linha, indiceLinha) => (
          <View
            key={indiceLinha}
            className={`flex-row ${
              indiceLinha !== linhas.length - 1 ? 'border-b border-hairline-light dark:border-hairline-dark' : ''
            } ${indiceLinha === 0 ? 'bg-subtle-light dark:bg-subtle-dark' : ''}`}
          >
            {linha.map((celula, indiceColuna) => (
              <View
                key={indiceColuna}
                className={`flex-1 ${
                  indiceColuna !== linha.length - 1 ? 'border-r border-hairline-light dark:border-hairline-dark' : ''
                }`}
              >
                <TextInput
                  value={celula}
                  onChangeText={(valor) => onMudarCelula(bloco.id, indiceLinha, indiceColuna, valor)}
                  placeholder={indiceLinha === 0 ? 'Coluna' : '—'}
                  placeholderTextColor={tokens.muted}
                  className="px-2.5 py-2 text-[14px] text-ink-light dark:text-ink-dark"
                  style={{ padding: 0, paddingHorizontal: 10, paddingVertical: 8 }}
                />
              </View>
            ))}
          </View>
        ))}
      </View>

      <View className="mt-1.5 flex-row gap-2">
        <Pressable
          onPress={() => onAdicionarLinha(bloco.id)}
          className="flex-row items-center gap-1 rounded-full bg-subtle-light px-3 py-1.5 active:opacity-70 dark:bg-subtle-dark"
        >
          <Feather name="plus" size={12} color={tokens.muted} />
          <AppText variant="small">Linha</AppText>
        </Pressable>
        <Pressable
          onPress={() => onAdicionarColuna(bloco.id)}
          className="flex-row items-center gap-1 rounded-full bg-subtle-light px-3 py-1.5 active:opacity-70 dark:bg-subtle-dark"
        >
          <Feather name="plus" size={12} color={tokens.muted} />
          <AppText variant="small">Coluna</AppText>
        </Pressable>
      </View>
    </View>
  );
}

export const BlocoVisual = memo(
  BlocoVisualBase,
  (anterior, proximo) =>
    anterior.bloco === proximo.bloco && anterior.larguraDisponivel === proximo.larguraDisponivel
);
