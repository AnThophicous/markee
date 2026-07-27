import type { ReactNode } from 'react';
import { View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';

import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import type { NoteWithTags } from '@/types';
import { useSoftDeleteNote, useUpdateNote } from '../hooks/useNoteMutations';
import { NoteListItem } from './NoteListItem';

type NoteListProps = {
  notes: NoteWithTags[] | undefined;
  isLoading: boolean;
  emptyTitle: string;
  emptySubtitle?: string;
  emptyAction?: ReactNode;
  /** Folga para a barra de navegação do sistema e para o botão flutuante. */
  bottomInset?: number;
};

type Row = { kind: 'header'; label: string } | { kind: 'note'; note: NoteWithTags };

/**
 * As fixadas ganham um grupo próprio no topo.
 *
 * A consulta já devolve fixadas primeiro, então basta achar onde a primeira
 * não-fixada começa — não precisa reordenar nada aqui.
 */
function buildRows(notes: NoteWithTags[]): Row[] {
  const pinned = notes.filter((note) => note.isPinned);
  const rest = notes.filter((note) => !note.isPinned);

  if (pinned.length === 0) {
    return rest.map((note) => ({ kind: 'note', note }));
  }

  return [
    { kind: 'header', label: 'FIXADAS' },
    ...pinned.map((note): Row => ({ kind: 'note', note })),
    ...(rest.length > 0 ? [{ kind: 'header', label: 'OUTRAS' } as Row] : []),
    ...rest.map((note): Row => ({ kind: 'note', note })),
  ];
}

export function NoteList({
  notes,
  isLoading,
  emptyTitle,
  emptySubtitle,
  emptyAction,
  bottomInset = 0,
}: NoteListProps) {
  const router = useRouter();
  const updateNote = useUpdateNote();
  const softDeleteNote = useSoftDeleteNote();

  if (!isLoading && (!notes || notes.length === 0)) {
    return (
      <EmptyState icon="file-text" title={emptyTitle} subtitle={emptySubtitle}>
        {emptyAction}
      </EmptyState>
    );
  }

  const rows = buildRows(notes ?? []);

  return (
    <FlashList
      data={rows}
      keyExtractor={(row) => (row.kind === 'header' ? 'h:' + row.label : row.note.id)}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: bottomInset }}
      renderItem={({ item }) =>
        item.kind === 'header' ? (
          <View className="px-5 pb-2 pt-2">
            <AppText variant="small">{item.label}</AppText>
          </View>
        ) : (
          <NoteListItem
            note={item.note}
            onPress={() => router.push({ pathname: '/note/[id]', params: { id: item.note.id } })}
            onToggleFavorite={() =>
              updateNote.mutate({ id: item.note.id, patch: { isFavorite: !item.note.isFavorite } })
            }
            onTogglePin={() => updateNote.mutate({ id: item.note.id, patch: { isPinned: !item.note.isPinned } })}
            onDelete={() => softDeleteNote.mutate(item.note.id)}
          />
        )
      }
    />
  );
}
