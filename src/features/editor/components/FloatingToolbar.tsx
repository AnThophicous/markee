import { Pressable, ScrollView, View, type TextStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';

export type ToolbarAction =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bullet'
  | 'numbered'
  | 'checklist'
  | 'quote'
  | 'code'
  | 'bold'
  | 'italic'
  | 'link'
  | 'table'
  | 'image';

const TEXT_BUTTONS: { action: ToolbarAction; label: string; style?: TextStyle }[] = [
  { action: 'h1', label: 'H1', style: { fontWeight: '700' } },
  { action: 'h2', label: 'H2', style: { fontWeight: '700' } },
  { action: 'h3', label: 'H3', style: { fontWeight: '700' } },
  { action: 'bullet', label: '•' },
  { action: 'numbered', label: '1.' },
  { action: 'checklist', label: '☑' },
  { action: 'quote', label: '❝' },
  { action: 'code', label: '</>' },
  { action: 'bold', label: 'B', style: { fontWeight: '700' } },
  { action: 'italic', label: 'I', style: { fontStyle: 'italic' } },
];

type FloatingToolbarProps = {
  onAction: (action: ToolbarAction) => void;
  onDone: () => void;
  bottomInset?: number;
};

export function FloatingToolbar({ onAction, onDone, bottomInset = 0 }: FloatingToolbarProps) {
  const { tokens } = useTheme();

  return (
    <View
      className="flex-row items-center border-t border-hairline-light bg-surface-light dark:border-hairline-dark dark:bg-surface-dark"
      // Com o teclado aberto o inset some sozinho; fechado, a barra fica acima
      // dos botões do sistema.
      style={{ height: 52 + bottomInset, paddingBottom: bottomInset }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // Sem isto, tocar num botão tira o foco do editor e fecha o teclado.
        keyboardShouldPersistTaps="always"
        contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 4, gap: 2 }}
      >
        {TEXT_BUTTONS.map((button) => (
          <Pressable
            key={button.action}
            onPress={() => onAction(button.action)}
            className="h-11 w-11 items-center justify-center rounded-lg active:bg-subtle-light dark:active:bg-subtle-dark"
          >
            <AppText style={button.style}>{button.label}</AppText>
          </Pressable>
        ))}
        <Pressable
          onPress={() => onAction('link')}
          className="h-11 w-11 items-center justify-center rounded-lg active:bg-subtle-light dark:active:bg-subtle-dark"
        >
          <Feather name="link" size={16} color={tokens.ink} />
        </Pressable>
        <Pressable
          onPress={() => onAction('table')}
          className="h-11 w-11 items-center justify-center rounded-lg active:bg-subtle-light dark:active:bg-subtle-dark"
        >
          <Feather name="grid" size={16} color={tokens.ink} />
        </Pressable>
        <Pressable
          onPress={() => onAction('image')}
          className="h-11 w-11 items-center justify-center rounded-lg active:bg-subtle-light dark:active:bg-subtle-dark"
        >
          <Feather name="image" size={16} color={tokens.ink} />
        </Pressable>
      </ScrollView>
      <View className="my-2 w-px self-stretch bg-hairline-light dark:bg-hairline-dark" />
      <Pressable onPress={onDone} className="h-12 w-12 items-center justify-center">
        <Feather name="chevron-down" size={20} color={tokens.accent} />
      </Pressable>
    </View>
  );
}
