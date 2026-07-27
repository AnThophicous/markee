import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Fab } from '@/components/Fab';
import { CategoryFilterRow } from '@/features/categories/components/CategoryFilterRow';
import { CategorySheet } from '@/features/categories/components/CategorySheet';
import { useCategories, useCategoryCounts } from '@/features/categories/hooks/useCategories';
import { ScreenHeader } from '@/features/navigation/components/ScreenHeader';
import { NewNoteSheet } from '@/features/notes/components/NewNoteSheet';
import { NoteList } from '@/features/notes/components/NoteList';
import { useNotes } from '@/features/notes/hooks/useNotes';
import { useCreateNote } from '@/features/notes/hooks/useNoteMutations';
import type { NoteTemplate } from '@/features/notes/templates';
import { useBottomInset } from '@/hooks/useBottomInset';
import { caiuNaSessaoAnterior } from '@/services/crash-reporter';
import { useTheme } from '@/theme/ThemeProvider';

export default function HomeScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const bottom = useBottomInset(96);

  const [categoriaFiltrada, setCategoriaFiltrada] = useState<string | null>(null);
  const [categoriasVisivel, setCategoriasVisivel] = useState(false);

  // `undefined` quando não há filtro: o serviço trata `null` como "sem
  // categoria nenhuma", que é um filtro de verdade e não a ausência dele.
  const { data: notes, isLoading } = useNotes(
    categoriaFiltrada ? { categoryId: categoriaFiltrada } : {}
  );
  const { data: categorias } = useCategories();
  const { data: contagens } = useCategoryCounts();
  const createNote = useCreateNote();

  const [templatesVisible, setTemplatesVisible] = useState(false);

  /**
   * Lido uma única vez, na montagem, porque a própria leitura apaga a marca —
   * é o que impede o aviso de reaparecer para sempre depois de uma queda só.
   */
  const [caiuAntes, setCaiuAntes] = useState(() => caiuNaSessaoAnterior());

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

  return (
    <View className="flex-1 bg-canvas-light dark:bg-canvas-dark">
      <ScreenHeader title="Notas" rightIcon="search" onRightPress={() => router.push('/search')} />

      {/* Aparece sozinho depois de uma queda. Sem isto, a informação existiria
          mas ninguém saberia que existe — e o defeito continuaria sem relato. */}
      {caiuAntes ? (
        <Pressable
          onPress={() => router.push('/diagnostics')}
          className="mx-4 mb-2 flex-row items-center gap-3 rounded-2xl bg-surface-light px-4 py-3 active:opacity-70 dark:bg-surface-dark"
        >
          <Feather name="alert-triangle" size={16} color={tokens.danger} />
          <View className="flex-1">
            <AppText variant="caption" className="text-ink-light dark:text-ink-dark">
              O app fechou sozinho da última vez
            </AppText>
            <AppText variant="small">Toque para ver o motivo e enviar o relato</AppText>
          </View>
          <Pressable onPress={() => setCaiuAntes(false)} hitSlop={12}>
            <Feather name="x" size={16} color={tokens.muted} />
          </Pressable>
        </Pressable>
      ) : null}

      <CategoryFilterRow
        categorias={categorias ?? []}
        contagens={contagens ?? {}}
        selecionada={categoriaFiltrada}
        onSelecionar={setCategoriaFiltrada}
        onGerenciar={() => setCategoriasVisivel(true)}
      />

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

      <CategorySheet
        visible={categoriasVisivel}
        onClose={() => setCategoriasVisivel(false)}
        modo="gerenciar"
        selecionada={categoriaFiltrada}
        onSelecionar={setCategoriaFiltrada}
      />
    </View>
  );
}
