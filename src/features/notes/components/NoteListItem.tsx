import { Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { Entrada } from '@/components/Entrada';
import { Toque } from '@/components/Toque';
import { useTheme } from '@/theme/ThemeProvider';
import type { Category, NoteWithTags } from '@/types';
import { formatRelativeDate } from '@/utils/date';
import { previewSnippet } from '@/utils/text';

const ACTION_WIDTH = 60;
const ACTIONS_TOTAL = ACTION_WIDTH * 3;
/** Criticamente amortecida (damping = 2·√stiffness): rápida e sem oscilar. */
const SPRING = { damping: 40, stiffness: 400, mass: 1 };

type NoteListItemProps = {
  note: NoteWithTags;
  /** Posição na lista, para a entrada em cascata. */
  indice?: number;
  /** Já resolvida pela lista; nula quando a nota não tem categoria. */
  categoria: Category | null;
  onPress: () => void;
  onTogglePin: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
};

export function NoteListItem({
  note,
  indice,
  categoria,
  onPress,
  onTogglePin,
  onToggleFavorite,
  onDelete,
}: NoteListItemProps) {
  const { tokens } = useTheme();
  const translateX = useSharedValue(0);

  const close = () => {
    translateX.value = withSpring(0, SPRING);
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((event) => {
      translateX.value = Math.min(0, Math.max(-ACTIONS_TOTAL, event.translationX));
    })
    .onEnd(() => {
      if (translateX.value < -ACTIONS_TOTAL / 2) {
        translateX.value = withSpring(-ACTIONS_TOTAL, SPRING);
      } else {
        close();
      }
    });

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  const snippet = previewSnippet(note.content);
  const hasTitle = Boolean(note.title.trim());

  return (
    <Entrada indice={indice} className="mx-4 mb-2.5 overflow-hidden rounded-[28px]">
      <View className="absolute right-0 top-0 h-full flex-row">
        <SwipeAction icon="star" tone="accent" onPress={() => { onToggleFavorite(); close(); }} />
        <SwipeAction icon="bookmark" tone="ink" onPress={() => { onTogglePin(); close(); }} />
        <SwipeAction icon="trash-2" tone="danger" onPress={onDelete} />
      </View>

      <GestureDetector gesture={pan}>
        <Animated.View
          style={rowStyle}
          // Canto 28 e sem borda: no Material 3 a separação entre cartão e
          // fundo é feita por TOM, não por contorno. O `subtle` é justamente o
          // nível de superfície acima do fundo.
          className="rounded-[28px] bg-subtle-light dark:bg-subtle-dark"
        >
          {/* A capa é uma faixa fina no topo do cartão, não um fundo colorido:
              o texto da nota continua sobre o mesmo fundo de sempre e a cor não
              precisa de contraste nenhum para o cartão seguir legível. */}
          {note.coverColor ? (
            <View
              style={{ backgroundColor: note.coverColor }}
              className="h-1.5 rounded-t-[28px]"
            />
          ) : null}

          <Toque onPress={onPress} className="px-4 py-3.5">
            <View className="flex-row items-start gap-2">
              {note.emoji ? (
                <AppText style={{ fontSize: 19, lineHeight: 24 }}>{note.emoji}</AppText>
              ) : null}
              <View className="flex-1">
                <AppText
                  variant="bodyEmphasis"
                  numberOfLines={1}
                  className={hasTitle ? undefined : 'text-muted-light dark:text-muted-dark'}
                >
                  {note.title.trim() || 'Sem título'}
                </AppText>

                {snippet ? (
                  <AppText variant="caption" numberOfLines={2} className="mt-1">
                    {snippet}
                  </AppText>
                ) : null}
              </View>

              <View className="flex-row items-center gap-1.5 pt-0.5">
                {note.isPinned ? <Feather name="bookmark" size={13} color={tokens.muted} /> : null}
                {note.isFavorite ? <Feather name="star" size={13} color={tokens.accent} /> : null}
              </View>
            </View>

            <View className="mt-2.5 flex-row items-center gap-1.5">
              {/* A etiqueta vem antes da data porque é o que se procura correndo
                  o olho pela lista — cor e nome juntos, para funcionar também
                  para quem não distingue as cores. */}
              {categoria ? (
                <View
                  style={{ backgroundColor: categoria.color + '22' }}
                  className="flex-row items-center gap-1 rounded-full px-2 py-0.5"
                >
                  <Feather
                    name={categoria.icon as keyof typeof Feather.glyphMap}
                    size={10}
                    color={categoria.color}
                  />
                  <AppText variant="small" style={{ color: categoria.color }}>
                    {categoria.name}
                  </AppText>
                </View>
              ) : null}

              <AppText variant="small" className="mr-auto">
                {formatRelativeDate(note.updatedAt)}
              </AppText>

              {/* Duas tags cabem sem apertar; o resto vira um contador. */}
              {note.tags.slice(0, 2).map((tag) => (
                <View key={tag} className="rounded-full bg-subtle-light px-2 py-0.5 dark:bg-subtle-dark">
                  <AppText variant="small" numberOfLines={1}>
                    #{tag}
                  </AppText>
                </View>
              ))}
              {note.tags.length > 2 ? (
                <AppText variant="small">+{note.tags.length - 2}</AppText>
              ) : null}
            </View>
          </Toque>
        </Animated.View>
      </GestureDetector>
    </Entrada>
  );
}

function SwipeAction({
  icon,
  tone,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  tone: 'accent' | 'ink' | 'danger';
  onPress: () => void;
}) {
  const background =
    tone === 'accent' ? 'bg-accent' : tone === 'danger' ? 'bg-danger' : 'bg-ink-light dark:bg-subtle-dark';

  return (
    <Pressable onPress={onPress} style={{ width: ACTION_WIDTH }} className={`items-center justify-center ${background}`}>
      <Feather name={icon} size={17} color="#fff" />
    </Pressable>
  );
}
