import { Pressable, ScrollView, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';
import type { TipoBloco } from '../model/blocks';

/**
 * Barra de ações acima do teclado.
 *
 * A barra anterior tinha botões escritos "H1", "H2", "</>" e "❝". Isso só é
 * legível para quem já conhece markdown — para todo mundo é um símbolo sem
 * significado, e a pessoa descobre o que faz por tentativa e erro. Aqui cada
 * botão tem ícone e a palavra do que ele faz.
 *
 * A ordem segue frequência de uso, não a hierarquia do formato: tarefa e lista
 * aparecem antes de título porque são o que mais se usa numa nota de estudo.
 */

type Atalho = {
  tipo: TipoBloco;
  rotulo: string;
  icone: keyof typeof Feather.glyphMap;
};

const ATALHOS: Atalho[] = [
  { tipo: 'tarefa', rotulo: 'Tarefa', icone: 'check-square' },
  { tipo: 'lista', rotulo: 'Lista', icone: 'list' },
  { tipo: 'titulo', rotulo: 'Título', icone: 'type' },
  { tipo: 'subtitulo', rotulo: 'Subtítulo', icone: 'minus' },
  { tipo: 'citacao', rotulo: 'Citação', icone: 'message-square' },
  { tipo: 'codigo', rotulo: 'Código', icone: 'code' },
];

type BarraDeBlocosProps = {
  bottomInset?: number;
  onInserir: () => void;
  onTipoRapido: (tipo: TipoBloco) => void;
  onImagem: () => void;
  onPronto: () => void;
};

export function BarraDeBlocos({
  bottomInset = 0,
  onInserir,
  onTipoRapido,
  onImagem,
  onPronto,
}: BarraDeBlocosProps) {
  const { tokens } = useTheme();

  return (
    <View
      className="flex-row items-center border-t border-hairline-light bg-surface-light dark:border-hairline-dark dark:bg-surface-dark"
      // Com o teclado aberto o inset some sozinho; fechado, a barra fica acima
      // dos botões do sistema.
      style={{ height: 56 + bottomInset, paddingBottom: bottomInset }}
    >
      {/* Fora da rolagem, para o caminho de inserir qualquer coisa estar sempre
          no mesmo lugar em vez de depender de onde a barra parou. */}
      <Pressable
        onPress={onInserir}
        className="ml-2 h-10 w-10 items-center justify-center rounded-xl bg-accent active:opacity-80"
      >
        <Feather name="plus" size={20} color="#FFFFFF" />
      </Pressable>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // Sem isto, tocar num botão tira o foco do editor e fecha o teclado.
        keyboardShouldPersistTaps="always"
        contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 6, gap: 4 }}
      >
        {ATALHOS.map((atalho) => (
          <Pressable
            key={atalho.tipo}
            onPress={() => onTipoRapido(atalho.tipo)}
            className="h-10 flex-row items-center gap-1.5 rounded-xl px-2.5 active:bg-subtle-light dark:active:bg-subtle-dark"
          >
            <Feather name={atalho.icone} size={15} color={tokens.ink} />
            <AppText variant="small" className="text-ink-light dark:text-ink-dark">
              {atalho.rotulo}
            </AppText>
          </Pressable>
        ))}

        <Pressable
          onPress={onImagem}
          className="h-10 flex-row items-center gap-1.5 rounded-xl px-2.5 active:bg-subtle-light dark:active:bg-subtle-dark"
        >
          <Feather name="image" size={15} color={tokens.ink} />
          <AppText variant="small" className="text-ink-light dark:text-ink-dark">
            Foto
          </AppText>
        </Pressable>
      </ScrollView>

      <View className="my-2.5 w-px self-stretch bg-hairline-light dark:bg-hairline-dark" />

      <Pressable onPress={onPronto} className="h-12 w-12 items-center justify-center">
        <Feather name="chevron-down" size={20} color={tokens.accent} />
      </Pressable>
    </View>
  );
}
