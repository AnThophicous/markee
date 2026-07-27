import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Divider } from '@/components/Divider';
import { EmptyState } from '@/components/EmptyState';
import { Sheet } from '@/components/Sheet';
import { ScreenHeader } from '@/features/navigation/components/ScreenHeader';
import { useEmptyTrash, usePermanentlyDeleteNote, useRestoreNote } from '@/features/notes/hooks/useNoteMutations';
import { useNotes } from '@/features/notes/hooks/useNotes';
import { useBottomInset } from '@/hooks/useBottomInset';
import { useTheme } from '@/theme/ThemeProvider';
import { formatRelativeDate } from '@/utils/date';
import { previewSnippet } from '@/utils/text';

export default function TrashScreen() {
  const { tokens } = useTheme();
  const bottom = useBottomInset(16);
  const { data: notes, isLoading } = useNotes({ trashed: true });
  const restoreNote = useRestoreNote();
  const permanentlyDeleteNote = usePermanentlyDeleteNote();
  const emptyTrash = useEmptyTrash();
  const [confirmVisible, setConfirmVisible] = useState(false);

  return (
    <View className="flex-1 bg-canvas-light dark:bg-canvas-dark">
      <ScreenHeader
        title="Lixeira"
        rightIcon={notes && notes.length > 0 ? 'trash-2' : undefined}
        onRightPress={() => setConfirmVisible(true)}
      />

      {!isLoading && (!notes || notes.length === 0) ? (
        <EmptyState icon="trash-2" title="Lixeira vazia" subtitle="Notas excluídas aparecem aqui por segurança." />
      ) : (
        <FlashList
          data={notes ?? []}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={Divider}
          contentContainerStyle={{ paddingBottom: bottom }}
          renderItem={({ item }) => (
            <View className="flex-row items-center gap-3 px-4 py-3.5">
              <View className="flex-1">
                <AppText variant="bodyEmphasis" numberOfLines={1}>
                  {item.title || 'Nota sem título'}
                </AppText>
                <AppText variant="caption" numberOfLines={1} className="mt-0.5">
                  {previewSnippet(item.content) || 'Nenhum conteúdo'}
                </AppText>
                <AppText variant="small" className="mt-1">
                  Excluída {formatRelativeDate(item.deletedAt ?? item.updatedAt)}
                </AppText>
              </View>
              <Pressable
                onPress={() => restoreNote.mutate(item.id)}
                className="h-9 w-9 items-center justify-center rounded-full active:bg-subtle-light dark:active:bg-subtle-dark"
              >
                <Feather name="rotate-ccw" size={18} color={tokens.accent} />
              </Pressable>
              <Pressable
                onPress={() => permanentlyDeleteNote.mutate(item.id)}
                className="h-9 w-9 items-center justify-center rounded-full active:bg-subtle-light dark:active:bg-subtle-dark"
              >
                <Feather name="x" size={18} color={tokens.danger} />
              </Pressable>
            </View>
          )}
        />
      )}

      <Sheet visible={confirmVisible} onClose={() => setConfirmVisible(false)} edge="bottom">
        <AppText variant="heading" className="mb-2 px-1">
          Esvaziar lixeira?
        </AppText>
        <AppText variant="caption" className="mb-4 px-1">
          Todas as notas na lixeira serão excluídas permanentemente. Esta ação não pode ser desfeita.
        </AppText>
        <Button
          label="Esvaziar lixeira"
          variant="danger"
          onPress={() => {
            emptyTrash.mutate();
            setConfirmVisible(false);
          }}
        />
      </Sheet>
    </View>
  );
}
