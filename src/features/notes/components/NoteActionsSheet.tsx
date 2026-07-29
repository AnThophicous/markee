import { Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Divider } from '@/components/Divider';
import { Sheet } from '@/components/Sheet';
import { useTheme } from '@/theme/ThemeProvider';
import type { NoteWithTags } from '@/types';

type NoteActionsSheetProps = {
  visible: boolean;
  onClose: () => void;
  note: NoteWithTags;
  onToggleFavorite: () => void;
  onTogglePin: () => void;
  onMoveToFolder: () => void;
  onSetCategory: () => void;
  onSetLook: () => void;
  onSetReminder: () => void;
  onMakeCards: () => void;
  onExport: () => void;
  onDelete: () => void;
};

export function NoteActionsSheet({
  visible,
  onClose,
  note,
  onToggleFavorite,
  onTogglePin,
  onMoveToFolder,
  onSetCategory,
  onSetLook,
  onSetReminder,
  onMakeCards,
  onExport,
  onDelete,
}: NoteActionsSheetProps) {
  const { tokens } = useTheme();

  const row = (
    icon: keyof typeof Feather.glyphMap,
    label: string,
    onPress: () => void,
    danger?: boolean
  ) => (
    <Pressable
      onPress={() => {
        onClose();
        onPress();
      }}
      className="flex-row items-center gap-3 py-3.5"
    >
      <Feather name={icon} size={18} color={danger ? tokens.danger : tokens.ink} />
      <AppText variant="body" className={danger ? 'text-danger' : undefined}>
        {label}
      </AppText>
    </Pressable>
  );

  return (
    <Sheet visible={visible} onClose={onClose} edge="bottom">
      {row('star', note.isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos', onToggleFavorite)}
      <Divider />
      {row('bookmark', note.isPinned ? 'Desafixar nota' : 'Fixar nota', onTogglePin)}
      <Divider />
      {row('tag', 'Categoria', onSetCategory)}
      <Divider />
      {row('smile', 'Emoji e capa', onSetLook)}
      <Divider />
      {row('folder', 'Mover para pasta', onMoveToFolder)}
      <Divider />
      {row('bell', 'Lembrete', onSetReminder)}
      <Divider />
      {row('layers', 'Virar cartas de revisão', onMakeCards)}
      <Divider />
      {row('share', 'Exportar Markdown', onExport)}
      <Divider />
      {row('trash-2', 'Excluir nota', onDelete, true)}
    </Sheet>
  );
}
