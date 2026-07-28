import { Pressable, ScrollView, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Sheet } from '@/components/Sheet';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * A cara da nota: um emoji e uma cor de capa.
 *
 * A categoria já responde "de que assunto é". Isto responde outra coisa: qual é
 * ESTA nota. Numa lista de trinta notas todas etiquetadas "Aulas", o que faz
 * achar a certa em um segundo é o 🧪 na frente de uma e o 📐 na frente da outra
 * — mais rápido do que ler trinta títulos.
 *
 * Grava na hora, sem botão de salvar: cada toque é uma escolha completa, e o
 * resultado aparece atrás do painel enquanto se escolhe.
 */

/**
 * Mesma paleta dos gráficos e das categorias, conferida com validador para
 * seguir distinguível para quem enxerga cores de forma diferente.
 */
const CORES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];

/** Matérias e o que costuma virar nota na vida de quem estuda. */
const EMOJIS = [
  '📘', '🧪', '📐', '🧬',
  '🌍', '⚗️', '🖥️', '🎨',
  '🎵', '⚽', '🩺', '⚖️',
  '💰', '🗺️', '✏️', '💡',
  '📊', '🔬', '🗣️', '⭐',
];

type NoteLookSheetProps = {
  visible: boolean;
  onClose: () => void;
  corAtual: string | null;
  emojiAtual: string | null;
  onMudar: (patch: { coverColor?: string | null; emoji?: string | null }) => void;
};

export function NoteLookSheet({
  visible,
  onClose,
  corAtual,
  emojiAtual,
  onMudar,
}: NoteLookSheetProps) {
  const { tokens } = useTheme();

  return (
    <Sheet visible={visible} onClose={onClose} edge="bottom">
      <ScrollView showsVerticalScrollIndicator={false} className="max-h-[500px]">
        <AppText variant="heading" className="mb-1 px-1">
          Cara da nota
        </AppText>
        <AppText variant="caption" className="mb-4 px-1">
          Aparece na lista, para achar esta nota de longe.
        </AppText>

        <AppText variant="caption" className="mb-2 px-1">
          EMOJI
        </AppText>
        <View className="mb-4 flex-row flex-wrap gap-2">
          {/* Primeiro da grade, e não escondido num botão de "limpar": tirar o
              emoji é tão comum quanto escolher um. */}
          <Pressable
            onPress={() => onMudar({ emoji: null })}
            className={`h-11 w-11 items-center justify-center rounded-xl ${
              emojiAtual ? 'bg-subtle-light dark:bg-subtle-dark' : 'bg-accent-soft'
            }`}
            style={!emojiAtual ? { borderWidth: 1.5, borderColor: tokens.accent } : undefined}
          >
            <Feather name="slash" size={16} color={tokens.muted} />
          </Pressable>

          {EMOJIS.map((opcao) => (
            <Pressable
              key={opcao}
              onPress={() => onMudar({ emoji: opcao })}
              className={`h-11 w-11 items-center justify-center rounded-xl ${
                emojiAtual === opcao ? 'bg-accent-soft' : 'bg-subtle-light dark:bg-subtle-dark'
              }`}
              style={emojiAtual === opcao ? { borderWidth: 1.5, borderColor: tokens.accent } : undefined}
            >
              <AppText style={{ fontSize: 20 }}>{opcao}</AppText>
            </Pressable>
          ))}
        </View>

        <AppText variant="caption" className="mb-2 px-1">
          CAPA
        </AppText>
        <View className="mb-2 flex-row flex-wrap gap-2.5">
          <Pressable
            onPress={() => onMudar({ coverColor: null })}
            className={`h-10 w-10 items-center justify-center rounded-full ${
              corAtual ? 'bg-subtle-light dark:bg-subtle-dark' : ''
            }`}
            style={
              corAtual
                ? undefined
                : { borderWidth: 2, borderColor: tokens.accent, backgroundColor: tokens.subtle }
            }
          >
            <Feather name="slash" size={15} color={tokens.muted} />
          </Pressable>

          {CORES.map((opcao) => (
            <Pressable
              key={opcao}
              onPress={() => onMudar({ coverColor: opcao })}
              style={{ backgroundColor: opcao }}
              className="h-10 w-10 items-center justify-center rounded-full"
            >
              {corAtual === opcao ? <Feather name="check" size={16} color="#FFFFFF" /> : null}
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Sheet>
  );
}
