import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { AppText } from '@/components/AppText';
import { IconButton } from '@/components/IconButton';
import { AiSheet } from '@/features/ai/components/AiSheet';
import { BlockEditor } from '@/features/editor/components/BlockEditor';
import { MarkdownPreview } from '@/features/editor/components/MarkdownPreview';
import { FolderPickerSheet } from '@/features/folders/components/FolderPickerSheet';
import { CategorySheet } from '@/features/categories/components/CategorySheet';
import { NoteActionsSheet } from '@/features/notes/components/NoteActionsSheet';
import { NoteLookSheet } from '@/features/notes/components/NoteLookSheet';
import { CardsSheet } from '@/features/review/components/CardsSheet';
import { useNote } from '@/features/notes/hooks/useNote';
import { useSoftDeleteNote, useUpdateNote } from '@/features/notes/hooks/useNoteMutations';
import { ReminderSheet } from '@/features/reminders/components/ReminderSheet';
import { exportNoteAsMarkdown } from '@/services/export.service';
import { useTheme } from '@/theme/ThemeProvider';

export default function NoteEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();

  const { data: note, isLoading } = useNote(id);
  const updateNote = useUpdateNote();
  const softDeleteNote = useSoftDeleteNote();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mode, setMode] = useState<'read' | 'edit'>('edit');
  const [actionsVisible, setActionsVisible] = useState(false);
  const [folderPickerVisible, setFolderPickerVisible] = useState(false);
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [lookVisible, setLookVisible] = useState(false);
  const [reminderVisible, setReminderVisible] = useState(false);
  const [aiVisible, setAiVisible] = useState(false);
  const [cardsVisible, setCardsVisible] = useState(false);

  const hasInitialized = useRef(false);
  const startedBlank = useRef(false);

  useEffect(() => {
    if (note && !hasInitialized.current) {
      setTitle(note.title);
      setContent(note.content);
      const isBlank = note.title === '' && note.content === '';
      startedBlank.current = isBlank;
      setMode(isBlank ? 'edit' : 'read');
      hasInitialized.current = true;
    }
  }, [note]);

  useEffect(() => {
    if (!hasInitialized.current || !id) return;
    const timeout = setTimeout(() => {
      updateNote.mutate({ id, patch: { title, content } });
    }, 600);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content]);

  const saveNow = () => {
    if (!id || !hasInitialized.current) return;
    updateNote.mutate({ id, patch: { title, content } });
  };

  const handleBack = () => {
    saveNow();
    router.back();
  };

  const handleDelete = () => {
    if (!id) return;
    softDeleteNote.mutate(id);
    router.back();
  };

  const enterEditMode = () => setMode('edit');
  const exitEditMode = () => {
    saveNow();
    setMode('read');
  };

  if (isLoading || !note || !id) {
    return <View className="flex-1 bg-canvas-light dark:bg-canvas-dark" />;
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-canvas-light dark:bg-canvas-dark"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ paddingTop: insets.top + 4 }} className="flex-row items-center gap-1 px-2 pb-1">
        <IconButton name="chevron-left" onPress={handleBack} />

        {/* Antes não havia nada indicando que existiam dois modos: a pessoa
            tocava no texto e ele "virava" editável sem aviso. */}
        <View className="ml-1 flex-row rounded-full bg-subtle-light p-0.5 dark:bg-subtle-dark">
          {(['edit', 'read'] as const).map((option) => (
            <Pressable
              key={option}
              onPress={() => (option === 'edit' ? enterEditMode() : exitEditMode())}
              className={`flex-row items-center gap-1.5 rounded-full px-3 py-1.5 ${
                mode === option ? 'bg-canvas-light dark:bg-canvas-dark' : ''
              }`}
            >
              <Feather
                name={option === 'edit' ? 'edit-2' : 'book-open'}
                size={13}
                color={mode === option ? tokens.accent : tokens.muted}
              />
              <AppText variant="small" className={mode === option ? 'text-ink-light dark:text-ink-dark' : undefined}>
                {option === 'edit' ? 'Escrever' : 'Ler'}
              </AppText>
            </Pressable>
          ))}
        </View>

        <View className="flex-1 items-end">
          <AppText variant="small">{updateNote.isPending ? 'Salvando…' : ''}</AppText>
        </View>

        <IconButton name="cpu" onPress={() => setAiVisible(true)} />
        <IconButton name="more-horizontal" onPress={() => setActionsVisible(true)} />
      </View>

      {/* A capa fica logo abaixo da barra e acima do título — é o mesmo lugar
          onde ela aparece no cartão da lista, então a escolha é vista do jeito
          que vai ficar. */}
      {note.coverColor ? (
        <View style={{ backgroundColor: note.coverColor }} className="mx-5 mb-2 h-1.5 rounded-full" />
      ) : null}

      <View className="flex-row items-center gap-2 px-5 pb-1 pt-1">
        {/* Tocar no emoji abre o painel: é o caminho mais curto para trocá-lo, e
            quem já escolheu um não precisa procurar de novo no menu. */}
        <Pressable onPress={() => setLookVisible(true)} hitSlop={8}>
          {note.emoji ? (
            <AppText style={{ fontSize: 26 }}>{note.emoji}</AppText>
          ) : (
            <Feather name="smile" size={20} color={tokens.muted} />
          )}
        </Pressable>

        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Título"
          placeholderTextColor={tokens.muted}
          returnKeyType="next"
          className="flex-1 text-[24px] font-bold leading-[30px] text-ink-light dark:text-ink-dark"
        />
      </View>

      {mode === 'read' ? (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable onPress={enterEditMode}>
            <MarkdownPreview content={content} />
          </Pressable>
        </ScrollView>
      ) : (
        <BlockEditor
          // A chave amarra o editor à nota. Sem ela, ir de uma nota para outra
          // reaproveitaria a mesma instância, e o editor — que lê o markdown
          // só na montagem — continuaria mostrando o conteúdo da nota anterior.
          key={id}
          markdownInicial={content}
          onChange={setContent}
          onRequestDone={exitEditMode}
          autoFocus={startedBlank.current}
          bottomInset={insets.bottom}
        />
      )}

      <NoteActionsSheet
        visible={actionsVisible}
        onClose={() => setActionsVisible(false)}
        note={note}
        onToggleFavorite={() => updateNote.mutate({ id, patch: { isFavorite: !note.isFavorite } })}
        onTogglePin={() => updateNote.mutate({ id, patch: { isPinned: !note.isPinned } })}
        onMoveToFolder={() => setFolderPickerVisible(true)}
        onSetCategory={() => setCategoryPickerVisible(true)}
        onSetLook={() => setLookVisible(true)}
        onSetReminder={() => setReminderVisible(true)}
        onMakeCards={() => setCardsVisible(true)}
        onExport={() => exportNoteAsMarkdown(title, content)}
        onDelete={handleDelete}
      />

      <FolderPickerSheet
        visible={folderPickerVisible}
        onClose={() => setFolderPickerVisible(false)}
        selectedFolderId={note.folderId}
        onSelect={(folderId) => updateNote.mutate({ id, patch: { folderId } })}
      />

      <CategorySheet
        visible={categoryPickerVisible}
        onClose={() => setCategoryPickerVisible(false)}
        modo="escolher"
        selecionada={note.categoryId}
        onSelecionar={(categoryId) => updateNote.mutate({ id, patch: { categoryId } })}
      />

      <NoteLookSheet
        visible={lookVisible}
        onClose={() => setLookVisible(false)}
        corAtual={note.coverColor}
        emojiAtual={note.emoji}
        onMudar={(patch) => updateNote.mutate({ id, patch })}
      />

      <ReminderSheet
        visible={reminderVisible}
        onClose={() => setReminderVisible(false)}
        noteId={id}
        noteTitle={title}
      />

      <CardsSheet
        visible={cardsVisible}
        onClose={() => setCardsVisible(false)}
        noteId={id}
        conteudo={content}
      />

      <AiSheet
        visible={aiVisible}
        onClose={() => setAiVisible(false)}
        content={content}
        onInsert={(markdown) => setContent((current) => current + markdown)}
        onSetTitle={setTitle}
        nota={{ id, titulo: title }}
        onSetContent={setContent}
        onOpenSettings={() => router.push('/settings')}
        onUpgrade={() => router.push('/upgrade')}
      />
    </KeyboardAvoidingView>
  );
}
