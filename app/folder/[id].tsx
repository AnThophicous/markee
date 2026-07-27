import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Divider } from '@/components/Divider';
import { Fab } from '@/components/Fab';
import { Sheet } from '@/components/Sheet';
import { FolderFormSheet } from '@/features/folders/components/FolderFormSheet';
import { useDeleteFolder, useFolders } from '@/features/folders/hooks/useFolders';
import { ScreenHeader } from '@/features/navigation/components/ScreenHeader';
import { NewNoteSheet } from '@/features/notes/components/NewNoteSheet';
import { NoteList } from '@/features/notes/components/NoteList';
import { useNotes } from '@/features/notes/hooks/useNotes';
import { useCreateNote } from '@/features/notes/hooks/useNoteMutations';
import type { NoteTemplate } from '@/features/notes/templates';
import { useBottomInset } from '@/hooks/useBottomInset';
import { useTheme } from '@/theme/ThemeProvider';

export default function FolderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { tokens } = useTheme();
  const bottom = useBottomInset(96);
  const { data: folders } = useFolders();
  const { data: notes, isLoading } = useNotes({ folderId: id });
  const createNote = useCreateNote();
  const deleteFolder = useDeleteFolder();

  const [actionsVisible, setActionsVisible] = useState(false);
  const [renameVisible, setRenameVisible] = useState(false);
  const [subfolderVisible, setSubfolderVisible] = useState(false);
  const [templatesVisible, setTemplatesVisible] = useState(false);

  const folder = (folders ?? []).find((item) => item.id === id);
  const subfolders = (folders ?? []).filter((item) => item.parentId === id);

  if (!id || !folder) {
    return <View className="flex-1 bg-canvas-light dark:bg-canvas-dark" />;
  }

  const openNote = (noteId: string) => router.push({ pathname: '/note/[id]', params: { id: noteId } });

  const handleCreateNote = () => {
    setTemplatesVisible(false);
    createNote.mutate({ folderId: id }, { onSuccess: (note) => openNote(note.id) });
  };

  const handleCreateFromTemplate = (template: NoteTemplate) => {
    setTemplatesVisible(false);
    createNote.mutate(
      { folderId: id, title: template.title(new Date()), content: template.content },
      { onSuccess: (note) => openNote(note.id) }
    );
  };

  const handleDeleteFolder = () => {
    setActionsVisible(false);
    deleteFolder.mutate(id, { onSuccess: () => router.back() });
  };

  return (
    <View className="flex-1 bg-canvas-light dark:bg-canvas-dark">
      <ScreenHeader
        title={folder.name}
        showMenu={false}
        onBackPress={() => router.back()}
        rightIcon="more-horizontal"
        onRightPress={() => setActionsVisible(true)}
      />

      {subfolders.length > 0 ? (
        <View>
          {subfolders.map((sub) => (
            <View key={sub.id}>
              <Pressable
                onPress={() => router.push({ pathname: '/folder/[id]', params: { id: sub.id } })}
                className="flex-row items-center justify-between px-4 py-3"
              >
                <View className="flex-row items-center gap-3">
                  <Feather name="folder" size={16} color={tokens.muted} />
                  <AppText variant="body">{sub.name}</AppText>
                </View>
                <Feather name="chevron-right" size={16} color={tokens.muted} />
              </Pressable>
              <Divider />
            </View>
          ))}
        </View>
      ) : null}

      <NoteList
        notes={notes}
        isLoading={isLoading}
        emptyTitle="Nenhuma nota nesta pasta"
        emptySubtitle="Toque no + para criar a primeira."
        bottomInset={bottom}
      />

      <Fab onPress={handleCreateNote} onLongPress={() => setTemplatesVisible(true)} />

      <NewNoteSheet
        visible={templatesVisible}
        onClose={() => setTemplatesVisible(false)}
        onPickBlank={handleCreateNote}
        onPickTemplate={handleCreateFromTemplate}
      />

      <Sheet visible={actionsVisible} onClose={() => setActionsVisible(false)} edge="bottom">
        <Pressable
          onPress={() => {
            setActionsVisible(false);
            setRenameVisible(true);
          }}
          className="flex-row items-center gap-3 py-3.5"
        >
          <Feather name="edit-2" size={18} color={tokens.ink} />
          <AppText variant="body">Renomear pasta</AppText>
        </Pressable>
        <Divider />
        <Pressable
          onPress={() => {
            setActionsVisible(false);
            setSubfolderVisible(true);
          }}
          className="flex-row items-center gap-3 py-3.5"
        >
          <Feather name="folder-plus" size={18} color={tokens.ink} />
          <AppText variant="body">Nova subpasta</AppText>
        </Pressable>
        <Divider />
        <Pressable onPress={handleDeleteFolder} className="flex-row items-center gap-3 py-3.5">
          <Feather name="trash-2" size={18} color={tokens.danger} />
          <AppText variant="body" className="text-danger">
            Excluir pasta
          </AppText>
        </Pressable>
      </Sheet>

      <FolderFormSheet
        visible={renameVisible}
        onClose={() => setRenameVisible(false)}
        mode="rename"
        initialName={folder.name}
        folderId={folder.id}
      />

      <FolderFormSheet
        visible={subfolderVisible}
        onClose={() => setSubfolderVisible(false)}
        mode="create"
        parentId={folder.id}
      />
    </View>
  );
}
