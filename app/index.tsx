import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Fab } from '@/components/Fab';
import { ScreenHeader } from '@/features/navigation/components/ScreenHeader';
import { NewNoteSheet } from '@/features/notes/components/NewNoteSheet';
import { NoteList } from '@/features/notes/components/NoteList';
import { useNotes } from '@/features/notes/hooks/useNotes';
import { useCreateNote } from '@/features/notes/hooks/useNoteMutations';
import type { NoteTemplate } from '@/features/notes/templates';
import { useBottomInset } from '@/hooks/useBottomInset';
import { useTheme } from '@/theme/ThemeProvider';

export default function HomeScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const bottom = useBottomInset(96);
  const { data: notes, isLoading } = useNotes({});
  const createNote = useCreateNote();

  const [templatesVisible, setTemplatesVisible] = useState(false);

  const open = (id: string) => router.push({ pathname: '/note/[id]', params: { id } });

  const createBlank = () => {
    setTemplatesVisible(false);
    createNote.mutate(undefined, { onSuccess: (note) => open(note.id) });
  };

  const createFromTemplate = (template: NoteTemplate) => {
    setTemplatesVisible(false);
    createNote.mutate(
      { title: template.title(new Date()), content: template.content },
      { onSuccess: (note) => open(note.id) }
    );
  };

  const isEmpty = !isLoading && (notes ?? []).length === 0;

  return (
    <View className="flex-1 bg-canvas-light dark:bg-canvas-dark">
      <ScreenHeader title="Notas" rightIcon="search" onRightPress={() => router.push('/search')} />

      <NoteList
        notes={notes}
        isLoading={isLoading}
        bottomInset={bottom}
        emptyTitle="Nenhuma nota ainda"
        emptySubtitle="Toque no + para escrever a sua primeira ideia."
        emptyAction={
          <Pressable
            onPress={() => setTemplatesVisible(true)}
            className="mt-2 flex-row items-center gap-2 rounded-full bg-subtle-light px-4 py-2.5 active:opacity-70 dark:bg-subtle-dark"
          >
            <Feather name="layout" size={15} color={tokens.ink} />
            <AppText variant="caption" className="text-ink-light dark:text-ink-dark">
              Começar com um modelo
            </AppText>
          </Pressable>
        }
      />

      <Fab onPress={createBlank} onLongPress={() => setTemplatesVisible(true)} />

      <NewNoteSheet
        visible={templatesVisible}
        onClose={() => setTemplatesVisible(false)}
        onPickBlank={createBlank}
        onPickTemplate={createFromTemplate}
      />
    </View>
  );
}
